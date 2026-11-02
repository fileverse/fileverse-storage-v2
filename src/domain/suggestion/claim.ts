import { File } from "../../infra/database/models";
import { FileIPFSType, SuggestionClaimResult } from "../../types";
import { isPortalLocked } from "../limit/portalLocked";

interface IClaimParams {
  cid: string;
  portal: string;
  linkId: string;
}

export const claimSuggestion = async ({
  cid,
  portal,
  linkId,
}: IClaimParams): Promise<SuggestionClaimResult> => {
  const owner = portal.toLowerCase();
  if (await isPortalLocked(owner)) return { ok: false, reason: "locked" };

  // A second claim by the same link is a client retry and succeeds again.
  const row = await File.findOneAndUpdate(
    {
      ipfsHash: cid,
      ipfsType: FileIPFSType.SUGGESTION,
      isDeleted: false,
      $or: [
        { "suggestion.claimed": false },
        { "suggestion.claimed": true, "suggestion.linkId": linkId },
      ],
    },
    {
      $set: {
        "suggestion.claimed": true,
        "suggestion.portal": owner,
        "suggestion.linkId": linkId,
        "suggestion.claimedAt": new Date(),
      },
    },
    { new: true }
  )
    .select("fileSize")
    .lean<{ fileSize?: number }>();
  if (row) return { ok: true, size: Number(row.fileSize) || 0 };

  const claimedElsewhere = await File.exists({
    ipfsHash: cid,
    ipfsType: FileIPFSType.SUGGESTION,
    isDeleted: false,
    "suggestion.claimed": true,
  });
  return {
    ok: false,
    reason: claimedElsewhere ? "claimed_elsewhere" : "not_found",
  };
};
