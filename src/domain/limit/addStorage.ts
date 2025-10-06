import { Limit } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";

export const addStorage = async ({
  contractAddress,
  diskSpace,
  shortCode,
}: {
  contractAddress: string;
  diskSpace: number;
  shortCode: string;
}) => {
  console.log({ contractAddress, diskSpace, shortCode });
  const limit = await Limit.findOne({ contractAddress });
  if (limit?.redeemMap && limit?.redeemMap[shortCode]) {
    return throwError({
      code: 400,
      message: "Storage already added for this floppy",
    });
  }
  console.log({ limit });

  const resp = await Limit.findOneAndUpdate(
    { contractAddress },
    {
      $inc: {
        extraStorage: diskSpace,
      },
      $set: {
        redeemMap: {
          ...limit?.redeemMap,
          [shortCode]: diskSpace,
        },
      },
    },
    { new: true }
  );

  console.log({ resp });
  if (!resp) {
    return throwError({
      code: 404,
      message: "Contract not found",
    });
  }
  return true;
};
