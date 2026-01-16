import { Limit } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";

interface AddStorageParams {
  contractAddress: string;
  diskSpace: number;
  shortCode: string;
  supportsMultipleClaims: boolean;
}

export const addStorage = async ({
  contractAddress,
  diskSpace,
  shortCode,
  supportsMultipleClaims,
}: AddStorageParams) => {
  const existingLimit = await Limit.findOne({ contractAddress });
  const existingRedeemValue = existingLimit?.redeemMap?.[shortCode];

  if (existingRedeemValue && !supportsMultipleClaims) {
    return throwError({
      code: 400,
      message: "Storage already added for this floppy",
    });
  }

  const newRedeemValue =
    supportsMultipleClaims && existingRedeemValue
      ? existingRedeemValue + diskSpace
      : diskSpace;

  const redeemMapDetails = existingLimit?.redeemMapDetails
    ? existingLimit.redeemMapDetails
    : {};

  await Limit.findOneAndUpdate(
    { contractAddress },
    {
      $inc: { extraStorage: diskSpace },
      $set: {
        redeemMap: {
          ...existingLimit?.redeemMap,
          [shortCode]: newRedeemValue,
        },
        redeemMapDetails: {
          ...existingLimit?.redeemMapDetails,
          [shortCode]: {
            claimCount: (redeemMapDetails[shortCode]?.claimCount || 0) + 1,
            lastClaimedAt: new Date(),
          },
        },
      },
    },
    { upsert: true }
  );

  return true;
};
