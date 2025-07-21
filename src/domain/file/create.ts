import { config } from "../../config";
import { File, Limit } from "../../infra/database/models";
import { FileIPFSType, IFile } from "../../types";
// omit isDeleted, isPinned, timeStamp
interface ICreateFileParams
  extends Omit<IFile, "isDeleted" | "isPinned" | "timeStamp" | "networkName"> {}

export const create = async (params: ICreateFileParams) => {
  const { contractAddress } = params;

  const newFile = await new File({
    ...params,
    networkName: config.NETWORK_NAME,
    isDeleted: false,
    isPinned: true,
  }).save();

  if (newFile.ipfsType === FileIPFSType.GATE) {
    const currentFileGateHashCount = await File.countDocuments({
      appFileId: params.appFileId,
      ipfsType: FileIPFSType.GATE,
      contractAddress: params.contractAddress,
      markedForUnpin: false,
      isPinned: true,
    });

    if (currentFileGateHashCount > Number(config.MAX_GATE_HISTORY_COUNT)) {
      // Get IDs of files to keep (most recent ones within the limit)
      const filesIdsToKeep = await File.find({
        appFileId: params.appFileId,
        ipfsType: FileIPFSType.GATE,
        contractAddress: params.contractAddress,
        markedForUnpin: false,
        isPinned: true,
      })
        .sort({ timeStamp: -1 })
        .limit(Number(config.MAX_GATE_HISTORY_COUNT))
        .select("_id");

      // Mark all other files for unpinning
      await File.updateMany(
        {
          appFileId: params.appFileId,
          ipfsType: FileIPFSType.GATE,
          contractAddress: params.contractAddress,
          markedForUnpin: false,
          isPinned: true,
          _id: {
            $nin: [...filesIdsToKeep.map((f) => f._id), newFile._id],
          },
        },
        {
          $set: {
            markedForUnpin: true,
          },
        }
      );
    }
  }

  // People are hitting ceiling too fast
  if (newFile.ipfsType === FileIPFSType.CONTENT) {
    await Limit.updateOne(
      { contractAddress },
      {
        $inc: { storageUse: newFile.fileSize },
        $setOnInsert: { contractAddress },
      },
      { upsert: true }
    );
  }
  return newFile.toObject();
};
