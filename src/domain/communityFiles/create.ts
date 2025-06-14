import { CommunityFiles } from "../../infra/database/models";
import { ICreateCommunityFilesParams } from "../../types";

export const create = async (params: ICreateCommunityFilesParams) => {
  const existingFile = await CommunityFiles.findOne({
    dsheetId: params.dsheetId,
    contractAddress: params.portalAddress,
  });

  if (existingFile) {
    throw new Error("File already exists");
  }

  const newCommunityFile = await new CommunityFiles(params).save();

  return newCommunityFile;
};
