import { CommunityFiles } from "../../infra/database/models";

export const favourite = async (fileId: string, invokerAddress: string) => {
  const file = await CommunityFiles.findOne({ _id: fileId });
  if (!file) {
    throw new Error("File not found");
  }

  const isFavorited = file.favoritedBy.includes(invokerAddress);
  if (isFavorited) {
    file.favoritedBy = file.favoritedBy.filter(
      (address) => address !== invokerAddress
    );
  } else {
    file.favoritedBy.push(invokerAddress);
  }

  await file.save();

  return file;
};
