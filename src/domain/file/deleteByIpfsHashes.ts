import { File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import { markUsageDirtyQuietly } from "../limit/docUsage";

interface IDeleteByIpfsHashesParams {
  contractAddress: string;
  ipfsHashes: string[];
}

export const deleteByIpfsHashes = async ({
  contractAddress,
  ipfsHashes,
}: IDeleteByIpfsHashesParams) => {
  const portal = contractAddress.toLowerCase();
  // Already-deleted rows are matched too so a retry still marks the
  // document for a recompute.
  const matchedFiles = await File.find({
    ipfsHash: { $in: ipfsHashes },
    contractAddress: portal,
  }).select("isDeleted ipfsType appFileId");

  if (matchedFiles.length === 0) {
    return { deletedCount: 0, bytesFreed: 0 };
  }

  const liveIds = matchedFiles.filter((f) => !f.isDeleted).map((f) => f._id);
  if (liveIds.length > 0) {
    await File.updateMany(
      { _id: { $in: liveIds } },
      { $set: { isDeleted: true, markedForUnpin: true } }
    );
  }

  const appFileIds = matchedFiles
    .filter((f) => f.ipfsType === FileIPFSType.CONTENT && f.appFileId)
    .map((f) => String(f.appFileId));
  if (appFileIds.length > 0) {
    await markUsageDirtyQuietly(
      { contractAddress: portal, appFileIds },
      { ipfsHashes }
    );
  }

  return { deletedCount: liveIds.length, bytesFreed: 0 };
};
