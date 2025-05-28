import { File } from "../../infra/database/models";

export const getSizeByContract = async (contractAddress: string) => {
  contractAddress = contractAddress.toLowerCase();
  // const startFrom = new Date();
  const res = await File.aggregate([
    {
      $match: {
        contractAddress,
        fileSize: { $gte: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalFileSize: { $sum: "$fileSize" },
      },
    },
  ]);
  const { totalFileSize } = (res && res[0]) || { totalFileSize: 0 };
  return { contractAddress, totalFileSize };
};
