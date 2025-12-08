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

  await Limit.findOneAndUpdate(
    { contractAddress },
    {
      $inc: { extraStorage: diskSpace },
      $set: {
        redeemMap: {
          ...existingLimit?.redeemMap,
          [shortCode]: newRedeemValue,
        },
      },
    },
    { upsert: true }
  );

  return true;
};
