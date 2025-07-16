import { File } from "../../infra/database/models";

export const updatePinningStatus = async (
  mongoObjectId: string | string[],
  isPinned: boolean
) => {
  if (Array.isArray(mongoObjectId)) {
    return await File.updateMany(
      { _id: { $in: mongoObjectId } },
      { $set: { isPinned } }
    );
  }
  return await File.updateOne({ _id: mongoObjectId }, { $set: { isPinned } });
};
