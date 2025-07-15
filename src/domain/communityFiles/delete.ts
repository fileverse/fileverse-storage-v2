import { CommunityFiles } from "../../infra/database/models";

interface IDeleteCommunityFileParams {
  appFileId: string;
  contractAddress: string;
}

export const deleteCommunityFile = async (
  params: IDeleteCommunityFileParams
) => {
  return await CommunityFiles.deleteOne({
    appFileId: params.appFileId,
    contractAddress: params.contractAddress,
  });
};
