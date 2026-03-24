import { File } from "../../infra/database/models";
import { getCommunityFile } from "../communityFiles";
import { deleteCommunityFile } from "../communityFiles/delete";

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

  return await File.updateMany(
    { ...criteria, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );
};
