import { DocUsage, Limit } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { reportError } from "../../infra/reporter";
import {
  computeDocCharge,
  computeStorageUse,
  getVersionCutoff,
  parseCutoff,
  serializeError,
} from "./docUsage";
import { rebuildPortalUsage } from "./rebuildPortalUsage";

const MAX_ATTEMPTS = 5;
const REBUILD_BATCH = 20;
const REBUILD_TIME_BUDGET_MS = 60_000;
const FAILURE_COOLDOWN_MS = 30_000;

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
        $set: { usageDirty: true, usageDirtyAt: Date.now() },
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
      "storage usage refresh gave up; portal queued for rebuild"
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
  rebuilt: number;
  deferred: number;
  cooling: number;
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
// A portal whose rebuild just failed would otherwise come straight back
// through its unsummed rows at the head of the next tick; hold it off.
const retryAfter = new Map<string, number>();

type PortalState = {
  contractAddress?: string;
  usageRebuiltAt?: number | null;
  usageDirty?: boolean;
};

// A portal without usageRebuiltAt has rows for only the documents touched
// since deploy; summing those would collapse its total. Such portals, and
// portals flagged usageDirty, are rebuilt from files instead of re-summed.
const needsRebuild = (state: PortalState | undefined) =>
  !state ||
  state.usageRebuiltAt === null ||
  state.usageRebuiltAt === undefined ||
  state.usageDirty === true;

// Flagged portals come first: a user is waiting on those, while unsummed
// portals only need their total refreshed.
const selectPortals = async (): Promise<string[]> => {
  const flagged: { contractAddress?: string }[] = await Limit.find({
    usageDirty: true,
  })
    .sort({ usageDirtyAt: 1 })
    .limit(REBUILD_BATCH)
    .select("contractAddress")
    .lean();
  const unsummed: string[] = await DocUsage.distinct("contractAddress", {
    summed: false,
  });
  const portals = new Set<string>();
  for (const f of flagged) {
    if (f.contractAddress) portals.add(f.contractAddress);
  }
  for (const p of unsummed) portals.add(p);
  return [...portals];
};

// Duplicate limits rows for one portal are a known data hazard; reading all
// of them keeps a stale duplicate from queueing a rebuild every tick.
const readStates = async (
  portals: string[]
): Promise<Map<string, PortalState>> => {
  const rows: PortalState[] = await Limit.find({
    contractAddress: { $in: portals },
  })
    .select("contractAddress usageRebuiltAt usageDirty")
    .lean();
  const states = new Map<string, PortalState>();
  for (const row of rows) {
    if (!row.contractAddress) continue;
    const prev = states.get(row.contractAddress);
    const unmarked =
      row.usageRebuiltAt === null || row.usageRebuiltAt === undefined;
    states.set(row.contractAddress, {
      contractAddress: row.contractAddress,
      usageRebuiltAt:
        unmarked || prev?.usageRebuiltAt === null
          ? null
          : prev?.usageRebuiltAt ?? row.usageRebuiltAt,
      usageDirty: Boolean(prev?.usageDirty) || row.usageDirty === true,
    });
  }
  return states;
};

const resumPortal = async (portal: string) => {
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
};

const rebuildPortal = async (portal: string) => {
  const r = await rebuildPortalUsage({ contractAddress: portal });
  await Limit.updateMany(
    { contractAddress: portal, usageDirty: true },
    { $set: { usageDirty: false } }
  );
  logger.info(
    { contractAddress: portal, ...r },
    "portal storage usage rebuilt from files"
  );
};

// A portal whose rebuild keeps failing goes to the back of the queue so the
// others keep draining.
const pushBack = async (portal: string) => {
  await Limit.updateMany(
    { contractAddress: portal },
    { $set: { usageDirty: true, usageDirtyAt: Date.now() } }
  ).catch(() => undefined);
};

const sumPortals = async (result: RefreshResult) => {
  const tickStartedAt = Date.now();
  const portals = await selectPortals();
  const states = await readStates(portals);
  for (const portal of portals) {
    if ((retryAfter.get(portal) ?? 0) > Date.now()) {
      result.cooling += 1;
      continue;
    }
    const rebuild = needsRebuild(states.get(portal));
    try {
      if (rebuild) {
        // Both bounds keep one tick well inside the job's lock lifetime.
        const overBudget =
          result.rebuilt >= REBUILD_BATCH ||
          Date.now() - tickStartedAt >= REBUILD_TIME_BUDGET_MS;
        if (overBudget) {
          result.deferred += 1;
          continue;
        }
        await rebuildPortal(portal);
        result.rebuilt += 1;
      } else {
        await resumPortal(portal);
      }
      result.portals += 1;
      sumFailures.delete(portal);
      retryAfter.delete(portal);
    } catch (err) {
      result.failed += 1;
      const failures = (sumFailures.get(portal) ?? 0) + 1;
      sumFailures.set(portal, failures);
      if (rebuild) {
        // A slow failing rebuild would otherwise eat most of the worker's
        // time; back off further on every consecutive failure.
        retryAfter.set(
          portal,
          Date.now() + FAILURE_COOLDOWN_MS * 2 ** Math.min(failures, 5)
        );
        await pushBack(portal);
      }
      logger.error(
        {
          contractAddress: portal,
          rebuild,
          failures,
          err: serializeError(err),
        },
        "storage usage portal pass failed; retried later"
      );
      if (failures === MAX_ATTEMPTS) {
        await reportError(
          `storage usage ${rebuild ? "rebuild" : "sum"} keeps failing for ` +
            `${portal}: ${err instanceof Error ? err.message : String(err)}`
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
    rebuilt: 0,
    deferred: 0,
    cooling: 0,
  };
  await refreshDirtyRows(limit, result);
  await sumPortals(result);
  return result;
};
