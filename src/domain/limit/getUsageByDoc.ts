import { DocUsage, Limit } from "../../infra/database/models";
import { getVersionCutoff, sumDocCharges } from "./docUsage";
import { computePortalDocUsages } from "./rebuildPortalUsage";

const MAX_DOCS = 500;

export interface StoredDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
  dirty: boolean;
  summed: boolean;
  attempts: number;
  lastError: string | null;
  updatedAt: number;
}

export interface LiveDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
}

export interface DocUsageEntry {
  appFileId: string;
  stored: StoredDocUsage | null;
  live: LiveDocUsage | null;
}

export interface PortalUsageByDoc {
  contractAddress: string;
  legacy: boolean;
  cutoff: number;
  storageUse: number;
  rowSum: number;
  liveSum: number | null;
  usageDirty: boolean;
  usageRebuiltAt: number | null;
  dirtyRows: number;
  unsummedRows: number;
  truncated: boolean;
  docs: DocUsageEntry[];
}

export const legacyPortalUsage = (
  contractAddress: string
): PortalUsageByDoc => ({
  contractAddress: contractAddress.toLowerCase(),
  legacy: true,
  cutoff: 0,
  storageUse: 0,
  rowSum: 0,
  liveSum: null,
  usageDirty: false,
  usageRebuiltAt: null,
  dirtyRows: 0,
  unsummedRows: 0,
  truncated: false,
  docs: [],
});

const weight = (entry: DocUsageEntry): number =>
  Math.max(entry.stored?.charge ?? 0, entry.live?.charge ?? 0);

export const getUsageByDoc = async ({
  contractAddress,
  live,
}: {
  contractAddress: string;
  live: boolean;
}): Promise<PortalUsageByDoc> => {
  const portal = contractAddress.toLowerCase();
  const [limit, rows, rowSum, dirtyRows, unsummedRows, cutoff] =
    await Promise.all([
      Limit.findOne({ contractAddress: portal }).select(
        "storageUse usageDirty usageRebuiltAt"
      ),
      DocUsage.find({ contractAddress: portal })
        .sort({ charge: -1 })
        .limit(MAX_DOCS)
        .lean(),
      sumDocCharges(portal),
      DocUsage.countDocuments({ contractAddress: portal, dirty: true }),
      DocUsage.countDocuments({ contractAddress: portal, summed: false }),
      getVersionCutoff({ contractAddress: portal }),
    ]);
  const liveDocs = live
    ? await computePortalDocUsages({ contractAddress: portal, cutoff })
    : null;

  const byId = new Map<string, DocUsageEntry>();
  for (const row of rows) {
    byId.set(row.appFileId, {
      appFileId: row.appFileId,
      stored: {
        charge: row.charge,
        countedVersions: row.countedVersions,
        latestFileSize: row.latestFileSize,
        latestTimeStamp: row.latestTimeStamp,
        dirty: row.dirty,
        summed: row.summed,
        attempts: row.attempts,
        lastError: row.lastError,
        updatedAt: row.updatedAt,
      },
      live: null,
    });
  }
  for (const doc of liveDocs ?? []) {
    const entry = byId.get(doc.appFileId) ?? {
      appFileId: doc.appFileId,
      stored: null,
      live: null,
    };
    entry.live = {
      charge: doc.charge,
      countedVersions: doc.countedVersions,
      latestFileSize: doc.latestFileSize,
      latestTimeStamp: doc.latestTimeStamp,
    };
    byId.set(doc.appFileId, entry);
  }
  const merged = [...byId.values()].sort((a, b) => weight(b) - weight(a));

  return {
    contractAddress: portal,
    legacy: false,
    cutoff,
    storageUse: limit?.storageUse ? Number(limit.storageUse) : 0,
    rowSum,
    liveSum: liveDocs
      ? liveDocs.reduce((sum, doc) => sum + doc.charge, 0)
      : null,
    usageDirty: Boolean(limit?.usageDirty),
    usageRebuiltAt: limit?.usageRebuiltAt
      ? Number(limit.usageRebuiltAt)
      : null,
    dirtyRows,
    unsummedRows,
    truncated: rows.length === MAX_DOCS || merged.length > MAX_DOCS,
    docs: merged.slice(0, MAX_DOCS),
  };
};
