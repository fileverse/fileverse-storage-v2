import { DocUsage, Limit } from "../../infra/database/models";
import { getVersionCutoff, sumDocCharges } from "./docUsage";

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

export interface DocUsageEntry {
  appFileId: string;
  stored: StoredDocUsage;
}

export interface PortalUsageByDoc {
  contractAddress: string;
  legacy: boolean;
  cutoff: number;
  storageUse: number;
  rowSum: number;
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
  usageDirty: false,
  usageRebuiltAt: null,
  dirtyRows: 0,
  unsummedRows: 0,
  truncated: false,
  docs: [],
});

export const getUsageByDoc = async ({
  contractAddress,
}: {
  contractAddress: string;
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
  const docs: DocUsageEntry[] = rows.map((row) => ({
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
  }));

  return {
    contractAddress: portal,
    legacy: false,
    cutoff,
    storageUse: limit?.storageUse ? Number(limit.storageUse) : 0,
    rowSum,
    usageDirty: Boolean(limit?.usageDirty),
    usageRebuiltAt: limit?.usageRebuiltAt
      ? Number(limit.usageRebuiltAt)
      : null,
    dirtyRows,
    unsummedRows,
    truncated: rows.length === MAX_DOCS,
    docs,
  };
};
