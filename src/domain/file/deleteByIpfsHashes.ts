import { File, Limit } from "../../infra/database/models";
import { FileIPFSType } from "../../types";

interface IDeleteByIpfsHashesParams {
  contractAddress: string;
  ipfsHashes: string[];
}

export const deleteByIpfsHashes = async ({
  contractAddress,
  ipfsHashes,
}: IDeleteByIpfsHashesParams) => {
  const matchedFiles = await File.find({
    ipfsHash: { $in: ipfsHashes },
    contractAddress: contractAddress.toLowerCase(),
    isDeleted: false,
  });

  if (matchedFiles.length === 0) {
    return { deletedCount: 0, bytesFreed: 0 };
  }

  const contentFiles = matchedFiles.filter(
    (f) => f.ipfsType === FileIPFSType.CONTENT
  );
  const totalSize = contentFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);

  const fileIds = matchedFiles.map((f) => f._id);
  await File.updateMany(
    { _id: { $in: fileIds } },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );

  if (totalSize > 0) {
    await Limit.updateOne(
      { contractAddress: contractAddress.toLowerCase() },
      { $inc: { storageUse: -totalSize } }
    );
  }

  return { deletedCount: matchedFiles.length, bytesFreed: totalSize };
};
