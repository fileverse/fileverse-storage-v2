import { config } from "../../config";
import { File, Limit, WorkspaceUploadLog } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { BucketTier, FileIPFSType, IFile } from "../../types";

interface ICreateFileParams
  extends Omit<IFile, "isDeleted" | "isPinned" | "timeStamp" | "networkName"> {
  tier?: BucketTier;
}

export const create = async (params: ICreateFileParams) => {
  const { contractAddress, tier } = params;
  const isWorkspace = tier === BucketTier.WORKSPACE;

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
    const setOnInsert: Record<string, unknown> = { contractAddress };
    if (isWorkspace) {
      setOnInsert.tier = BucketTier.WORKSPACE;
      setOnInsert.storageLimit = config.WORKSPACE_DEFAULT_STORAGE_LIMIT;
    }
    await Limit.updateOne(
      { contractAddress },
      {
        $inc: { storageUse: newFile.fileSize },
        $setOnInsert: setOnInsert,
      },
      { upsert: true }
    );
  }

  // Per-workspace audit trail. Append-only; logs every ipfsType (not just
  // CONTENT) so we have a complete record of what a team uploaded. Failures
  // here must not surface to the caller — the upload + Limit increment have
  // already succeeded.
  if (isWorkspace) {
    try {
      await WorkspaceUploadLog.create({
        contractAddress,
        ipfsHash: newFile.ipfsHash,
        fileSize: newFile.fileSize,
        invokerAddress: params.invokerAddress,
        ipfsType: newFile.ipfsType,
        uploadedAt: new Date(),
      });
    } catch (err) {
      logger.error(
        { err, contractAddress, ipfsHash: newFile.ipfsHash },
        "WorkspaceUploadLog write failed"
      );
    }
  }

  return newFile.toObject();
};
