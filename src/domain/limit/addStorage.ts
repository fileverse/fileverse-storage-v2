import { Limit } from "../../infra/database/models";

export const addStorage = async ({
  contractAddress,
  diskSpace,
}: {
  contractAddress: string;
  diskSpace: number;
}) => {
  const limit = await Limit.findOne({ contractAddress });

  if (
    limit &&
    limit.extendableStorage &&
    Number(limit.extendableStorage) <= 0
  ) {
    throw new Error("No storage available to extend");
  }

  const resp = await Limit.findOneAndUpdate(
    { contractAddress },
    {
      $inc: {
        extraStorage: diskSpace,
      },
    },
    { new: true }
  );

  if (!resp) {
    throw new Error("Contract not found");
  }
  return true;
};
