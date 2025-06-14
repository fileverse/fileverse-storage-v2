import { CommunityFiles } from "../../infra/database/models";
interface IGetFileParams {
  dsheetId: string;
  contractAddress: string;
}

export const getCommunityFile = async (params: IGetFileParams) => {
  const file = await CommunityFiles.findOne({
    dsheetId: params.dsheetId,
    contractAddress: params.contractAddress,
  });

  return file;
};
