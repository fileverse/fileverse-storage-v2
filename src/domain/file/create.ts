import { config } from "../../config";
import { File, Limit } from "../../infra/database/models";
import { IFile } from "../../types";
// omit isDeleted, isPinned, timeStamp
interface ICreateFileParams
  extends Omit<IFile, "isDeleted" | "isPinned" | "timeStamp" | "networkName"> {}

export const create = async (params: ICreateFileParams) => {
  const { fileSize, contractAddress } = params;
  console.log("params", params);
  const file = await new File({
    ...params,
    networkName: config.NETWORK_NAME,
    isDeleted: false,
    isPinned: true,
  }).save();

  await Limit.updateOne(
    { contractAddress },
    {
      $inc: { storageUse: fileSize },
      $setOnInsert: { contractAddress },
    },
    { upsert: true }
  );
  return file.toObject();
};
