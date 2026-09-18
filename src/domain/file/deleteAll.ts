import { File } from "../../infra/database/models";
import { getCommunityFile } from "../communityFiles";
import { deleteCommunityFile } from "../communityFiles/delete";
import { markUsageDirtyQuietly } from "../limit/docUsage";

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

  const result = await File.updateMany(
    { ...criteria, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );

  await markUsageDirtyQuietly(
    {
      contractAddress: criteria.contractAddress,
      appFileIds: [criteria.appFileId],
    },
    { appFileId: criteria.appFileId }
  );

  return result;
};
