import { CommunityFiles } from "../../infra/database/models";

interface ICreateCommunityFilesParams {
  publishedBy: string;
  thumbnailIPFSHash: string;
  title: string;
  category: string;
  fileIPFSHash: string;
}

export const create = async (params: ICreateCommunityFilesParams) => {
  const { publishedBy, thumbnailIPFSHash, title, category, fileIPFSHash } =
    params;

  const newCommunityFile = await new CommunityFiles({
    publishedBy,
    thumbnailIPFSHash,
    title,
    category,
    fileIPFSHash,
  }).save();

  return newCommunityFile;
};
