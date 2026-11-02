import { File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import { UNCLAIMED_SUGGESTION_TTL_MS } from "./limits";

// Uploads nobody registered within the TTL; the unpin job deletes the pins.
export const sweepUnclaimedSuggestions = async (now: number): Promise<number> => {
  const result = await File.updateMany(
    {
      ipfsType: FileIPFSType.SUGGESTION,
      "suggestion.claimed": false,
      isDeleted: false,
      timeStamp: { $lt: now - UNCLAIMED_SUGGESTION_TTL_MS },
    },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );
  return result.modifiedCount;
};
