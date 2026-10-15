import { File } from "../../infra/database/models";
import { deleteCommunityFiles } from "../communityFiles/delete";
import { markUsageDirtyQuietly } from "../limit/docUsage";

interface IDeleteAllCriteria {
  appFileId: string;
  contractAddress: string;
}

export const deleteAll = async (criteria: IDeleteAllCriteria) => {
  await deleteCommunityFiles({
    dsheetIds: [criteria.appFileId],
    portalAddress: criteria.contractAddress,
  });

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
