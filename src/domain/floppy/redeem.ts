import { SemaphoreProof } from "@semaphore-protocol/proof";
import { FloppyManager } from "./floppyManager";
import { Hex } from "viem";

export const redeem = async ({
  contractAddress,
  shortCode,
  proof,
}: {
  contractAddress?: string | null;
  shortCode: string;
  proof: SemaphoreProof;
}) => {
  const floppyManager = new FloppyManager(shortCode);

  return floppyManager.redeemFloppy(proof, contractAddress as Hex);
};
