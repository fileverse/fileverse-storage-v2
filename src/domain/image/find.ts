import Image from "../../infra/database/models/image";

// Private-lane images live in the Image collection (no File row); pinataId is
// set only on private uploads, so its presence is the lane discriminator.
export const findPrivateImage = async (hash: string) => {
  return await Image.findOne({ hash, pinataId: { $exists: true, $ne: null } });
};
