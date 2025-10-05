import { Group } from "@semaphore-protocol/group";
import { Floppy } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";
import { verifyProof } from "@semaphore-protocol/proof";

export const redeem = async ({
  contractAddress,
  invokerAddress,
  chainId,
  shortCode,
  proof,
}: {
  invokerAddress?: string | null;
  contractAddress?: string | null;
  chainId?: string | null;
  shortCode: string;
  proof: {
    merkleTreeDepth: number;
    merkleTreeRoot: string;
    nullifier: string;
    message: string;
    scope: string;
    points: string[];
  };
}) => {
  const floppy = await Floppy.findOne({ shortCode });
  if (!floppy) {
    return throwError({
      code: 404,
      message: "Floppy not found",
    });
  }
  const valid = await verifyProof(proof as any);
  if (!valid) {
    return throwError({
      code: 400,
      message: "Invalid proof",
    });
  }
  // add nullifier to floppy
  // add storage to corresponding portal
  return true;
};
