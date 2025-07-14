import { File } from "../../infra/database/models";

export const updatePinningStatus = async (
  mongoObjectId: string,
  isPinned: boolean
) => {
  return await File.updateOne({ _id: mongoObjectId }, { $set: { isPinned } });
};
