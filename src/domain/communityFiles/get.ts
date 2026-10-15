import { CommunityFiles } from "../../infra/database/models";
import { listingFilter } from "./filter";

interface IGetFileParams {
  dsheetId: string;
  contractAddress: string;
}

export const getCommunityFile = async (params: IGetFileParams) => {
  const file = await CommunityFiles.findOne(
    listingFilter([params.dsheetId], params.contractAddress)
  );

  return file;
};
