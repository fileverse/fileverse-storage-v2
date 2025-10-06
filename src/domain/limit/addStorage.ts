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
  const limit = await Limit.findOne({ contractAddress });

  if (
    limit &&
    limit.extendableStorage &&
    Number(limit.extendableStorage) <= 0
  ) {
    return throwError({
      code: 400,
      message: "No storage available to extend",
    });
  }

  if (limit?.redeemMap && limit.redeemMap[shortCode]) {
    return throwError({
      code: 400,
      message: "Storage already added for this floppy",
    });
  }

  const resp = await Limit.findOneAndUpdate(
    { contractAddress },
    {
      $inc: {
        extraStorage: diskSpace,
        redeemMap: {
          ...limit?.redeemMap,
          [shortCode]: diskSpace,
        },
      },
    },
    { new: true }
  );

  if (!resp) {
    return throwError({
      code: 404,
      message: "Contract not found",
    });
  }
  return true;
};
