import { CommunityFiles } from "../../infra/database/models";
import { ICreateCommunityFilesParams } from "../../types";

export const create = async (params: ICreateCommunityFilesParams) => {
  const newCommunityFile = await new CommunityFiles(params).save();

  return newCommunityFile;
};
