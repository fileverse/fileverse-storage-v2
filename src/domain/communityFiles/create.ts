import { CommunityFiles } from "../../infra/database/models";
import { ICreateCommunityFilesParams } from "../../types";
import { listingFilter } from "./filter";

export const create = async (params: ICreateCommunityFilesParams) => {
  const existingFile = await CommunityFiles.findOne(
    listingFilter([params.dsheetId], params.portalAddress)
  );

  if (existingFile) {
    throw new Error("File already exists");
  }

  const newCommunityFile = await new CommunityFiles(params).save();

  return newCommunityFile;
};
