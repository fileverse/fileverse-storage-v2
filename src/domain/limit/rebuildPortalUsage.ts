import { DocUsage, File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import {
  computeStorageUse,
  getVersionCutoff,
  parseCutoff,
  readStorageUse,
} from "./docUsage";

const DUPLICATE_KEY = 11000;

export interface PortalDocUsage {
  appFileId: string;
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
}

type WriteError = { code?: number; errmsg?: string; index?: number };
type BulkFailure = { writeErrors?: WriteError[] };

export const computePortalDocUsages = async ({
  contractAddress,
  cutoff,
}: {
  contractAddress: string;
  cutoff: number;
}): Promise<PortalDocUsage[]> => {
  const safeCutoff = parseCutoff(cutoff) ?? 1;
  const portal = contractAddress.toLowerCase();
  const groups: {
    _id: string;
    sizes: unknown[];
    latestTimeStamp: number | null;
  }[] = await File.aggregate([
    {
      $match: {
        contractAddress: portal,
        ipfsType: FileIPFSType.CONTENT,
        isDeleted: false,
        appFileId: { $type: "string", $ne: "" },
      },
    },
    { $sort: { timeStamp: -1, _id: -1 } },
    // $push and $first below rely on the $sort above running first; that
    // holds on an unsharded deployment.
    {
      $group: {
        _id: "$appFileId",
        sizes: { $push: { $ifNull: ["$fileSize", 0] } },
        latestTimeStamp: { $first: "$timeStamp" },
      },
    },
    {
      $project: {
        sizes: { $slice: ["$sizes", safeCutoff] },
        latestTimeStamp: 1,
      },
    },
  ]).allowDiskUse(true);

  return groups.map((g) => {
    const sizes = g.sizes.map((s) => Number(s) || 0);
    return {
      appFileId: g._id,
      latestFileSize: sizes[0] ?? 0,
      countedVersions: sizes.length,
      latestTimeStamp: Number(g.latestTimeStamp) || 0,
      charge: sizes.reduce((sum, size) => sum + size, 0),
    };
  });
};

const onlyDuplicateKeys = (errors: WriteError[] | undefined) =>
  Array.isArray(errors) &&
  errors.length > 0 &&
  errors.every((e) => e.code === DUPLICATE_KEY);

export const rebuildPortalUsage = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<{
  docs: number;
  skipped: number;
  before: number;
  after: number;
}> => {
  const portal = contractAddress.toLowerCase();
  const startedAt = Date.now();
  const before = await readStorageUse(portal);
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({
    contractAddress: portal,
    cutoff,
  });

  let skipped = 0;
  if (docs.length > 0) {
    const ops = docs.map((d) => {
      // Only rows untouched since startedAt are overwritten; a row the
      // worker wrote during this run wins and shows up as a duplicate key.
      const filter = {
        contractAddress: portal,
        appFileId: d.appFileId,
        updatedAt: { $lt: startedAt },
      };
      return {
        updateOne: {
          filter,
          update: {
            $set: {
              latestFileSize: d.latestFileSize,
              countedVersions: d.countedVersions,
              latestTimeStamp: d.latestTimeStamp,
              charge: d.charge,
              cutoff,
              updatedAt: Date.now(),
              summed: false,
            },
            $setOnInsert: {
              dirty: false,
              dirtyAt: null,
              attempts: 0,
              lastError: null,
            },
          },
          upsert: true,
        },
      };
    });
    try {
      await DocUsage.bulkWrite(ops, { ordered: false });
    } catch (err) {
      const errors = (err as BulkFailure).writeErrors;
      if (!onlyDuplicateKeys(errors)) {
        const detail = (errors ?? [])
          .slice(0, 3)
          .map((e) => `${e.code}: ${e.errmsg}`)
          .join("; ");
        throw new Error(
          `doc-usage bulk write failed for ${portal}: ${detail || String(err)}`
        );
      }
      skipped = errors?.length ?? 0;
    }
  }

  // Rows neither rewritten above nor waiting for the worker belong to
  // documents with no live content.
  await DocUsage.deleteMany({
    contractAddress: portal,
    updatedAt: { $lt: startedAt },
    dirty: false,
  });

  // Rows stay unsummed until the total is written, so an abort here leaves
  // the portal for the worker's next pass instead of a stale total.
  const sumStartedAt = Date.now();
  const after = await computeStorageUse({ contractAddress: portal });
  await DocUsage.updateMany(
    {
      contractAddress: portal,
      summed: false,
      updatedAt: { $lte: sumStartedAt },
    },
    { $set: { summed: true } }
  );
  return { docs: docs.length, skipped, before, after };
};
