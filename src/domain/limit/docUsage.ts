import { config } from "../../config";
import { DocUsage, File, Limit } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { reportError } from "../../infra/reporter";
import { FileIPFSType } from "../../types";

const DEFAULT_CUTOFF = 5;
const DUPLICATE_KEY = 11000;
const MAX_ATTEMPTS = 5;
const MAX_SUM_PASSES = 5;

const serializeError = (err: unknown) =>
  err instanceof Error
    ? { message: err.message, stack: err.stack }
    : { message: String(err) };

export const parseCutoff = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const resolveCutoff = (versionCutoff: unknown): number =>
  parseCutoff(versionCutoff) ??
  parseCutoff(config.STORAGE_VERSION_CUTOFF) ??
  DEFAULT_CUTOFF;

export const getVersionCutoff = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<number> => {
  const limit = await Limit.findOne({
    contractAddress: contractAddress.toLowerCase(),
  }).select("versionCutoff");
  const raw = limit?.versionCutoff;
  if (raw !== null && raw !== undefined && parseCutoff(raw) === null) {
    logger.warn(
      { contractAddress, versionCutoff: raw },
      "ignoring invalid versionCutoff; config default applies"
    );
  }
  return resolveCutoff(raw);
};

export interface DocCharge {
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
}

export const computeDocCharge = async ({
  contractAddress,
  appFileId,
  cutoff,
}: {
  contractAddress: string;
  appFileId: string;
  cutoff: number;
}): Promise<DocCharge> => {
  const safeCutoff = parseCutoff(cutoff) ?? 1;
  const rows = await File.find({
    contractAddress: contractAddress.toLowerCase(),
    appFileId,
    ipfsType: FileIPFSType.CONTENT,
    isDeleted: false,
  })
    .sort({ timeStamp: -1, _id: -1 })
    .limit(safeCutoff)
    .select("fileSize timeStamp");
  const sizes = rows.map((r) => Number(r.fileSize) || 0);
  return {
    latestFileSize: sizes[0] ?? 0,
    countedVersions: rows.length,
    latestTimeStamp: Number(rows[0]?.timeStamp) || 0,
    charge: sizes.reduce((sum, size) => sum + size, 0),
  };
};

const upsertOnce = async (
  filter: Record<string, unknown>,
  update: Record<string, unknown>
) => {
  try {
    await DocUsage.updateOne(filter, update, { upsert: true });
  } catch (err) {
    // A concurrent insert of the same row can win the race; the same upsert
    // then updates it.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    await DocUsage.updateOne(filter, update, { upsert: true });
  }
};

export const markUsageDirty = async ({
  contractAddress,
  appFileIds,
}: {
  contractAddress: string;
  appFileIds: string[];
}): Promise<number> => {
  const portal = contractAddress.toLowerCase();
  const now = Date.now();
  const ids = [...new Set(appFileIds.filter((id) => id && id.length > 0))];
  for (const appFileId of ids) {
    await upsertOnce(
      { contractAddress: portal, appFileId },
      {
        $set: { dirty: true, dirtyAt: now, attempts: 0 },
        $setOnInsert: {
          latestFileSize: 0,
          countedVersions: 0,
          latestTimeStamp: 0,
          charge: 0,
          cutoff: 0,
          updatedAt: 0,
          summed: true,
          lastError: null,
        },
      }
    );
  }
  return ids.length;
};

export const markUsageDirtyQuietly = async (
  params: { contractAddress: string; appFileIds: string[] },
  context: Record<string, unknown>
): Promise<number | null> => {
  try {
    return await markUsageDirty(params);
  } catch (err) {
    logger.error(
      {
        ...context,
        contractAddress: params.contractAddress,
        appFileIds: params.appFileIds,
        err: serializeError(err),
      },
      "failed to mark storage usage dirty; row write already committed"
    );
    return null;
  }
};

export const readStorageUse = async (
  contractAddress: string
): Promise<number> => {
  const limit = await Limit.findOne({ contractAddress }).select("storageUse");
  return limit?.storageUse ? Number(limit.storageUse) : 0;
};

export const sumDocCharges = async (portal: string): Promise<number> => {
  const [agg] = await DocUsage.aggregate([
    { $match: { contractAddress: portal } },
    { $group: { _id: null, total: { $sum: "$charge" } } },
  ]);
  return agg?.total ?? 0;
};

export const computeStorageUse = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<number> => {
  const portal = contractAddress.toLowerCase();
  for (let pass = 0; pass < MAX_SUM_PASSES; pass += 1) {
    const limit: { storageUse?: unknown } | null = await Limit.findOne({
      contractAddress: portal,
    })
      .select("storageUse")
      .lean();
    const total = await sumDocCharges(portal);
    if (!limit) {
      await Limit.updateOne(
        { contractAddress: portal },
        {
          $set: { storageUse: total },
          $setOnInsert: { contractAddress: portal },
        },
        { upsert: true }
      );
    } else {
      // Another writer may replace storageUse concurrently; only overwrite
      // the exact value read above so a newer sum is not clobbered.
      const before = limit.storageUse === undefined ? null : limit.storageUse;
      const res = await Limit.updateOne(
        { contractAddress: portal, storageUse: before },
        { $set: { storageUse: total } }
      );
      if (res.matchedCount === 0) continue;
    }
    // A write that landed after ours shows up here; re-sum so the stored
    // value and the rows agree.
    if ((await readStorageUse(portal)) === total) return total;
  }
  throw new Error(`storage usage sum did not settle for ${portal}`);
};

type DirtyRow = {
  _id: unknown;
  contractAddress: string;
  appFileId: string;
  dirtyAt: number | null;
  attempts?: number;
};

const recordFailure = async (row: DirtyRow, err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const attempts = (Number(row.attempts) || 0) + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  try {
    // A re-mark during processing owns the row; leave its fresh state alone.
    const res = await DocUsage.updateOne(
      { _id: row._id, dirtyAt: row.dirtyAt },
      { $set: { attempts, lastError: message, dirty: !exhausted } }
    );
    if (res.matchedCount === 0 || !exhausted) return;
    await Limit.updateOne(
      { contractAddress: row.contractAddress },
      {
        $set: { usageDirty: true },
        $setOnInsert: { contractAddress: row.contractAddress },
      },
      { upsert: true }
    );
    logger.error(
      {
        contractAddress: row.contractAddress,
        appFileId: row.appFileId,
        attempts,
        err: serializeError(err),
      },
      "storage usage refresh gave up; portal marked dirty"
    );
    await reportError(
      `storage usage refresh gave up for ${row.contractAddress} / ` +
        `${row.appFileId}: ${message}`
    ).catch(() => undefined);
  } catch (recordErr) {
    logger.error(
      {
        contractAddress: row.contractAddress,
        appFileId: row.appFileId,
        err: serializeError(recordErr),
      },
      "could not record storage usage refresh failure"
    );
    await reportError(
      `could not record storage usage refresh failure for ` +
        `${row.contractAddress} / ${row.appFileId}: ${message}`
    ).catch(() => undefined);
  }
};

export interface RefreshResult {
  processed: number;
  skipped: number;
  failed: number;
  portals: number;
}

const refreshDirtyRows = async (limit: number, result: RefreshResult) => {
  const rows: DirtyRow[] = await DocUsage.find({ dirty: true })
    .sort({ dirtyAt: 1 })
    .limit(parseCutoff(limit) ?? 1)
    .lean();
  const cutoffs = new Map<string, number>();

  for (const row of rows) {
    const portal = row.contractAddress;
    try {
      let cutoff = cutoffs.get(portal);
      if (cutoff === undefined) {
        cutoff = await getVersionCutoff({ contractAddress: portal });
        cutoffs.set(portal, cutoff);
      }
      const computed = await computeDocCharge({
        contractAddress: portal,
        appFileId: row.appFileId,
        cutoff,
      });
      const res = await DocUsage.updateOne(
        { _id: row._id, dirtyAt: row.dirtyAt },
        {
          $set: {
            ...computed,
            cutoff,
            updatedAt: Date.now(),
            dirty: false,
            summed: false,
            attempts: 0,
            lastError: null,
          },
        }
      );
      if (res.matchedCount === 0) {
        // Re-marked while computing; the next tick recomputes it.
        result.skipped += 1;
        continue;
      }
      result.processed += 1;
    } catch (err) {
      result.failed += 1;
      await recordFailure(row, err);
    }
  }
};

// Portal totals are replaced with the sum of their rows rather than adjusted
// by deltas, so a crash or an ambiguous write error between the row write
// and the portal write can only leave the total stale, never wrong; the
// summed flag brings such rows back on the next tick. Clearing summed by
// updatedAt is only safe because exactly one worker process runs this and
// row writes finish before the sums start; do not run more than one.
const sumFailures = new Map<string, number>();

const sumPortals = async (result: RefreshResult) => {
  const portals: string[] = await DocUsage.distinct("contractAddress", {
    summed: false,
  });
  for (const portal of portals) {
    try {
      const startedAt = Date.now();
      await computeStorageUse({ contractAddress: portal });
      await DocUsage.updateMany(
        {
          contractAddress: portal,
          summed: false,
          updatedAt: { $lte: startedAt },
        },
        { $set: { summed: true } }
      );
      result.portals += 1;
      sumFailures.delete(portal);
    } catch (err) {
      result.failed += 1;
      const failures = (sumFailures.get(portal) ?? 0) + 1;
      sumFailures.set(portal, failures);
      logger.error(
        { contractAddress: portal, failures, err: serializeError(err) },
        "storage usage sum failed; retried next tick"
      );
      if (failures === MAX_ATTEMPTS) {
        await reportError(
          `storage usage sum keeps failing for ${portal}: ` +
            (err instanceof Error ? err.message : String(err))
        ).catch(() => undefined);
      }
    }
  }
};

export const processDirtyRows = async ({
  limit,
}: {
  limit: number;
}): Promise<RefreshResult> => {
  const result: RefreshResult = {
    processed: 0,
    skipped: 0,
    failed: 0,
    portals: 0,
  };
  await refreshDirtyRows(limit, result);
  await sumPortals(result);
  return result;
};
