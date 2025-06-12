import { CommunityFiles } from "../../infra/database/models";

interface ICreateCommunityFilesParams {
  publishedBy: string;
  thumbnailIPFSHash: string;
  title: string;
  category: string;
  fileLink: string;
}

export const create = async (params: ICreateCommunityFilesParams) => {
  const { publishedBy, thumbnailIPFSHash, title, category, fileLink } = params;

  const newCommunityFile = await new CommunityFiles({
    publishedBy,
    thumbnailIPFSHash,
    title,
    category,
    fileLink,
  }).save();

  return newCommunityFile;
};
