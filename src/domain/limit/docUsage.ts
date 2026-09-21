import { config } from "../../config";
import { DocUsage, File, Limit } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { FileIPFSType } from "../../types";

const DEFAULT_CUTOFF = 5;
const DUPLICATE_KEY = 11000;
const MAX_SUM_PASSES = 5;

export const serializeError = (err: unknown) =>
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

// Once per portal: after rebuildPortalUsage sets usageRebuiltAt the filter
// never matches again. No upsert, so a missing limits row (a portal with no
// content) is left alone. A repeat call must not bump usageDirtyAt, or the
// portal would lose its place in the worker's queue.
export const flagPortalForRebuild = async (
  contractAddress: string
): Promise<void> => {
  try {
    await Limit.updateOne(
      {
        contractAddress: contractAddress.toLowerCase(),
        usageRebuiltAt: null,
        usageDirty: { $ne: true },
      },
      { $set: { usageDirty: true, usageDirtyAt: Date.now() } }
    );
  } catch (err) {
    logger.error(
      { contractAddress, err: serializeError(err) },
      "failed to flag portal for storage usage rebuild; next touch retries"
    );
  }
};
