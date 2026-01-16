import { Floppy, Limit } from "../../infra/database/models";

export const list = async ({
  identityCommitment,
  contractAddress,
}: {
  identityCommitment: string;
  contractAddress: string;
}) => {
  const limit = await Limit.findOne({ contractAddress });
  const shortCodes = limit?.redeemMap ? Object.keys(limit?.redeemMap) : [];
  let claimedFloppyList = await Floppy.find({
    shortCode: { $in: shortCodes },
  }).lean();
  let identityFloppyList: any[] = [];
  if (identityCommitment) {
    identityFloppyList = await Floppy.find({
      members: identityCommitment,
    }).lean();
  }
  let floppyMap: any = {};
  for (let floppy of claimedFloppyList) {
    floppyMap[floppy.shortCode] = {
      shortCode: floppy.shortCode,
      name: floppy.name,
      description: floppy.description,
      img: floppy.img,
      metadataURI: floppy.metadataURI,
      diskSpace: floppy.diskSpace,
      supportsMultipleClaims: floppy.supportsMultipleClaims || false,
      isClaimed: true,
    };
  }
  for (let floppy of identityFloppyList) {
    floppyMap[floppy.shortCode] = {
      shortCode: floppy.shortCode,
      name: floppy.name,
      description: floppy.description,
      img: floppy.img,
      metadataURI: floppy.metadataURI,
      diskSpace: floppy.diskSpace,
      supportsMultipleClaims: floppy.supportsMultipleClaims || false,
      isClaimed: false,
    };
  }
  const floppyList = Object.values(floppyMap);
  return floppyList;
};
