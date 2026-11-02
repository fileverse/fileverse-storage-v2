import { config } from "../../config";
import { File } from "../../infra/database/models";
import { FileIPFSType, IUploadedSuggestion } from "../../types";
import { uploadPrivateFile } from "../ipfs";

interface IPinnedSuggestion {
  ipfsHash: string;
  ipfsUrl: string;
  pinataId?: string;
  storageType: string;
}

const DUPLICATE_KEY = 11000;

export const recordSuggestionUpload = async (pinned: IPinnedSuggestion, size: number): Promise<void> => {
  // Same bytes, same row: the sweep must never unpin a CID a claimed row also uses.
  const existing = await File.exists({
    ipfsHash: pinned.ipfsHash,
    ipfsType: FileIPFSType.SUGGESTION,
    isDeleted: false,
  });
  if (existing) return;
  try {
    await new File({
      ipfsHash: pinned.ipfsHash,
      gatewayUrl: pinned.ipfsUrl,
      pinataId: pinned.pinataId,
      storageType: pinned.storageType,
      fileSize: size,
      tags: ["suggestion"],
      ipfsType: FileIPFSType.SUGGESTION,
      networkName: config.NETWORK_NAME,
      isDeleted: false,
      isPinned: true,
      suggestion: { claimed: false },
    }).save();
  } catch (error) {
    // The unique suggestion index: an identical upload that landed at the same time already recorded it.
    if ((error as { code?: number })?.code !== DUPLICATE_KEY) throw error;
  }
};

export const uploadSuggestion = async (
  data: Buffer
): Promise<IUploadedSuggestion> => {
  const pinned = await uploadPrivateFile({
    name: "suggestion",
    mimetype: "application/octet-stream",
    data,
  });
  if (!pinned?.ipfsHash) throw new Error("suggestion upload returned no cid");
  const size = Number(pinned.pinSize) || data.length;
  await recordSuggestionUpload(pinned, size);
  return { cid: pinned.ipfsHash, size };
};
