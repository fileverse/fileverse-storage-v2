import { Floppy } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";
import { verifyProof } from "@semaphore-protocol/proof";
import { addStorage } from "../limit";

export const redeem = async ({
  contractAddress,
  shortCode,
  proof,
}: {
  contractAddress?: string | null;
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
  if(floppy.nullifiers.includes(proof.nullifier)) {
    return throwError({
      code: 400,
      message: "Nullifier already used",
    });
  }
  const valid = await verifyProof(proof as any);
  if (!valid) {
    return throwError({
      code: 400,
      message: "Invalid proof",
    });
  }
  if(proof.message === `Redeem ${shortCode}`) {
    // add nullifier to floppy
    floppy.nullifiers.push(proof.nullifier);
    await floppy.save();
    // add storage to corresponding portal
    await addStorage({ contractAddress: contractAddress as string, diskSpace: floppy.diskSpace });
  }
  return true;
};
