import { CommunityFiles } from "../../infra/database/models";
import { listingFilter } from "./filter";

interface IDeleteCommunityFilesParams {
  dsheetIds: string[];
  portalAddress: string;
}

export const deleteCommunityFiles = async (
  params: IDeleteCommunityFilesParams
) => {
  return await CommunityFiles.deleteMany(
    listingFilter(params.dsheetIds, params.portalAddress)
  );
};
