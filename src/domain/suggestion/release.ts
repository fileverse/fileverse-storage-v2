import { File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";

export const releaseSuggestion = async (cid: string): Promise<void> => {
  await File.updateMany(
    { ipfsHash: cid, ipfsType: FileIPFSType.SUGGESTION, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );
};
