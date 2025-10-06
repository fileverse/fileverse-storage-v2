import { Floppy, Limit } from "../../infra/database/models";

export const list = async ({
  identityCommitment,
  contractAddress,
}: {
  identityCommitment: string;
  contractAddress: string;
}) => {
  const limit = await Limit.findOne({ contractAddress });
  const shortCodes = limit?.redeemMap
    ? Object.keys(limit?.redeemMap)
    : [];
  let claimedFloppyList = await Floppy.find({ shortCode: { $in: shortCodes } });
  let identityFloppyList: any[] = [];
  if(identityCommitment) {
    identityFloppyList = await Floppy.find({ members: identityCommitment });
  }
  let floppyMap: any = {};
  for(let floppy of claimedFloppyList) {
    floppyMap[floppy.shortCode] = {
      ...floppy,
      isClaimed: true,
    };
  }
  for(let floppy of identityFloppyList) {
    floppyMap[floppy.shortCode] = {
      ...floppy,
      isClaimed: false,
    };
  }
  const floppyList = Object.values(floppyMap);
  return floppyList;
};
