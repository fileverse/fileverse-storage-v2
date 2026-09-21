import "../src/infra/database";
import mongoose from "mongoose";
import { DocUsage, File, Limit } from "../src/infra/database/models";
import {
  computePortalDocUsages,
  getVersionCutoff,
  readStorageUse,
  rebuildPortalUsage,
} from "../src/domain/limit";
import { FileIPFSType } from "../src/types";

// Usage: npx ts-node scripts/rebuild-doc-usage.ts [--apply] [--portal <addr>]
//        [--dirty]
//
// Rebuilds doc-usages and limits.storageUse from the files collection. Dry-run
// by default: prints what would change and writes nothing. Safe to re-run.
// --dirty restricts the run to portals flagged usageDirty and clears the flag.
// The worker rebuilds each portal on its first /use or upload after deploy, so
// a full --apply is a backstop for portals never touched, not a prerequisite.

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyDirty = args.includes("--dirty");
const portalArgIndex = args.indexOf("--portal");
const onlyPortal =
  portalArgIndex >= 0 ? args[portalArgIndex + 1]?.toLowerCase() : undefined;

if (portalArgIndex >= 0 && !/^0x[0-9a-f]{40}$/.test(onlyPortal ?? "")) {
  console.error("--portal expects a 0x address");
  process.exit(1);
}
if (onlyPortal && onlyDirty) {
  console.error("--portal and --dirty cannot be combined");
  process.exit(1);
}

const toGB = (v: number) => `${(v / 1e9).toFixed(3)} GB`;

const portalFilter = onlyPortal ? { contractAddress: onlyPortal } : {};
const liveContent = {
  ipfsType: FileIPFSType.CONTENT,
  isDeleted: false,
  ...portalFilter,
};
const billable = {
  ...liveContent,
  appFileId: { $type: "string", $ne: "" },
};

async function indexNames(collection: string): Promise<string[]> {
  const indexes = await mongoose.connection.db
    .collection(collection)
    .indexes();
  return indexes.map((i: { name?: string }) => i.name ?? "");
}

async function preChecks(): Promise<{ uniqueIndexPresent: boolean }> {
  const [
    noFileSize,
    badFileSize,
    noAppFileId,
    newestUnbilled,
    noIpfsType,
    waitingRows,
    dirtyPortals,
    neverRebuilt,
    docUsageIndexes,
    fileIndexes,
    duplicateLimits,
  ] = await Promise.all([
    File.countDocuments({ ...liveContent, fileSize: null }),
    File.countDocuments({
      ...liveContent,
      fileSize: { $ne: null, $not: { $type: "number" } },
    }),
    File.countDocuments({
      ...liveContent,
      $nor: [{ appFileId: { $type: "string", $ne: "" } }],
    }),
    File.findOne({
      ...liveContent,
      $nor: [{ appFileId: { $type: "string", $ne: "" } }],
    })
      .sort({ timeStamp: -1 })
      .select("timeStamp")
      .lean(),
    File.countDocuments({ isDeleted: false, ipfsType: null, ...portalFilter }),
    DocUsage.countDocuments({ attempts: { $gt: 0 }, ...portalFilter }),
    Limit.countDocuments({ usageDirty: true, ...portalFilter }),
    Limit.countDocuments({ usageRebuiltAt: null, ...portalFilter }),
    indexNames("doc-usages"),
    indexNames("files"),
    Limit.aggregate([
      { $group: { _id: "$contractAddress", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "portals" },
    ]),
  ]);
  const uniqueIndexPresent = docUsageIndexes.includes(
    "contractAddress_1_appFileId_1"
  );
  const fileIndexPresent = fileIndexes.includes(
    "contractAddress_1_appFileId_1_ipfsType_1_isDeleted_1_timeStamp_-1__id_-1"
  );
  console.log("Pre-checks (live rows):");
  console.log(`  content rows with no fileSize:          ${noFileSize}`);
  console.log(`  content rows with non-numeric fileSize: ${badFileSize}`);
  console.log(`  content rows with no appFileId (unbilled): ${noAppFileId}`);
  const newest: { timeStamp?: number } | null = newestUnbilled;
  const newestAt = newest?.timeStamp
    ? new Date(newest.timeStamp).toISOString()
    : "none";
  console.log(`  newest such row (recent = live flow):   ${newestAt}`);
  console.log(`  rows with no ipfsType:                  ${noIpfsType}`);
  console.log(`  doc-usage rows with failed attempts:    ${waitingRows}`);
  console.log(`  portals flagged usageDirty:             ${dirtyPortals}`);
  console.log(`  limits rows never rebuilt (no marker):  ${neverRebuilt}`);
  console.log(
    `  limits rows sharing a contractAddress:  ` +
      `${duplicateLimits[0]?.portals ?? 0} portals`
  );
  console.log(
    `  doc-usages unique index present:        ${uniqueIndexPresent}`
  );
  console.log(`  files compound index present:           ${fileIndexPresent}`);
  return { uniqueIndexPresent };
}

async function listPortals(): Promise<string[]> {
  if (onlyPortal) return [onlyPortal];
  if (onlyDirty) {
    const rows = await Limit.find({ usageDirty: true }).select(
      "contractAddress"
    );
    return rows
      .map((r) => String(r.contractAddress ?? ""))
      .filter(Boolean)
      .map((p) => p.toLowerCase());
  }
  const portals: string[] = await File.distinct("contractAddress", billable);
  return portals.filter(Boolean).map((p) => p.toLowerCase());
}

async function dryRunPortal(portal: string) {
  const before = await readStorageUse(portal);
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({
    contractAddress: portal,
    cutoff,
  });
  const after = docs.reduce((sum, d) => sum + d.charge, 0);
  return { docs: docs.length, skipped: 0, before, after };
}

async function orphanedLimits(portalsWithContent: Set<string>) {
  const rows = await Limit.find({
    storageUse: { $exists: true, $ne: 0 },
    ...portalFilter,
  }).select("contractAddress storageUse");
  return rows.filter(
    (r) => r.contractAddress && !portalsWithContent.has(r.contractAddress)
  );
}

async function main() {
  // Model calls buffer until the connection opens; the raw index listing
  // does not, so wait for it here. init() creates the collections and
  // builds the declared indexes, which the running server may not have yet.
  await mongoose.connection.asPromise();
  await Promise.all([DocUsage.init(), File.init(), Limit.init()]);
  const mode = apply ? "apply" : "dry-run (pass --apply to write)";
  console.log(`MODE: ${mode}${onlyDirty ? ", dirty portals only" : ""}`);
  if (!apply) {
    console.log(
      "NOTE: --apply stamps limits.usageRebuiltAt, which tells the worker a " +
        "portal is already rebuilt. Only apply against a deployment that " +
        "runs the rebuild-on-first-touch worker; applying before that " +
        "deploy makes those portals skip their first-touch rebuild."
    );
  }

  if (onlyPortal) {
    const hasContent = await File.exists(liveContent);
    const hasLimit = await Limit.exists({ contractAddress: onlyPortal });
    if (!hasContent && !hasLimit) {
      console.log(
        `Portal ${onlyPortal} has no live content and no limits row; ` +
          "nothing to rebuild"
      );
      await mongoose.connection.close();
      return;
    }
  }

  console.log("Running pre-checks...");
  const { uniqueIndexPresent } = await preChecks();
  if (apply && !uniqueIndexPresent) {
    console.error(
      "Refusing to apply: the unique index on doc-usages is missing. " +
        "Check the index build error above, fix it, then re-run."
    );
    await mongoose.connection.close();
    process.exit(1);
  }

  const portals = await listPortals();
  console.log(`\nPortals to process: ${portals.length}`);

  if (portals.length === 0) {
    console.log(
      "No portals to process; refusing to touch limits or doc-usages"
    );
    await mongoose.connection.close();
    return;
  }

  const movers: {
    portal: string;
    docs: number;
    skipped: number;
    before: number;
    after: number;
  }[] = [];
  const runStartedAt = Date.now();
  for (const [i, portal] of portals.entries()) {
    const r = apply
      ? await rebuildPortalUsage({ contractAddress: portal })
      : await dryRunPortal(portal);
    movers.push({ portal, ...r });
    const label = apply ? "" : "would-be ";
    const skipped = r.skipped ? ` skipped=${r.skipped}` : "";
    console.log(
      `[${i + 1}/${portals.length}] ${portal} ${label}` +
        `${toGB(r.before)} -> ${toGB(r.after)} docs=${r.docs}${skipped}`
    );
    if (apply) {
      await Limit.updateMany(
        { contractAddress: portal, usageDirty: true },
        { $set: { usageDirty: false } }
      );
    }
  }

  const fullRun = !onlyPortal && !onlyDirty;
  const orphans = fullRun ? await orphanedLimits(new Set(portals)) : [];
  if (apply && orphans.length > 0) {
    await Limit.updateMany(
      { _id: { $in: orphans.map((o) => o._id) } },
      { $set: { storageUse: 0 } }
    );
  }
  if (apply && fullRun) {
    const { deletedCount } = await DocUsage.deleteMany({
      updatedAt: { $lt: runStartedAt },
      dirty: false,
    });
    console.log(
      `Removed ${deletedCount} doc-usage rows for documents with no live ` +
        "content"
    );
  }
  if (fullRun) {
    console.log(
      `Limits rows with non-zero storageUse and no live content: ` +
        `${orphans.length}` +
        (apply ? " (set to 0)" : " (would be set to 0)")
    );
  }

  const byDelta = [...movers].sort(
    (a, b) => a.after - a.before - (b.after - b.before)
  );
  const print = (title: string, rows: typeof movers) => {
    console.log(`\n${title}`);
    for (const m of rows) {
      console.log(
        `  ${m.portal}  docs=${m.docs}  ${toGB(m.before)} -> ${toGB(m.after)}`
      );
    }
  };
  print("Largest decreases:", byDelta.slice(0, 20));
  print("Largest increases:", byDelta.slice(-20).reverse());

  const totalBefore = movers.reduce((s, m) => s + m.before, 0);
  const totalAfter = movers.reduce((s, m) => s + m.after, 0);
  console.log(
    `\nTotal across portals: ${toGB(totalBefore)} -> ${toGB(totalAfter)}`
  );

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("ERROR:", err?.message ?? err);
  process.exit(1);
});
