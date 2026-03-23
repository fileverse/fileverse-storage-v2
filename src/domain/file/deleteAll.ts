import { File, Limit } from "../../infra/database/models";
import { getCommunityFile } from "../communityFiles";
import { deleteCommunityFile } from "../communityFiles/delete";
import { FileIPFSType } from "../../types";

interface IDeleteAllCriteria {
  appFileId: string;
  contractAddress: string;
}

export const deleteAll = async (criteria: IDeleteAllCriteria) => {
  const existingCommunityFile = await getCommunityFile({
    dsheetId: criteria.appFileId,
    contractAddress: criteria.contractAddress,
  });

  if (existingCommunityFile) {
    await deleteCommunityFile({
      appFileId: criteria.appFileId,
      contractAddress: criteria.contractAddress,
    });
  }

  const contentFiles = await File.find({
    ...criteria,
    isDeleted: false,
    ipfsType: FileIPFSType.CONTENT,
  }).select("fileSize");

  const totalSize = contentFiles.reduce(
    (acc, f) => acc + (f.fileSize || 0),
    0
  );

  const result = await File.updateMany(
    { ...criteria, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );

  if (totalSize > 0) {
    await Limit.updateOne(
      { contractAddress: criteria.contractAddress },
      { $inc: { storageUse: -totalSize } }
    );
  }

  return result;
};
