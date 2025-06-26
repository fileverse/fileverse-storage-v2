import { Limit } from "../../infra/database/models";

export const extendStorage = async ({
  contractAddress,
}: {
  contractAddress: string;
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
        extendableStorage: -1000000000,
        extraStorage: 1000000000,
      },
    },
    { new: true }
  );

  if (!resp) {
    throw new Error("Contract not found");
  }

  return true;
};
