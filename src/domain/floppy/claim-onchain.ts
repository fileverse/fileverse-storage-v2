import { SemaphoreProof } from "@semaphore-protocol/proof";
import { FLOPPY_CONTRACT_ABI } from "../../data/floppyContractAbi";
import { publicClient } from "../contract/viemClient";
import { config } from "../../config";
import { IOnChainFloppy } from "../../types";
import { throwError } from "../../infra/errorHandler";
import { AgentInstance } from "../../infra/smart-agent";
import { encodeFunctionData, Hex } from "viem";
import { addStorage } from "../limit/addStorage";

export const claimOnchain = async ({
  proof,
  shortCode,
  contractAddress,
}: {
  proof: SemaphoreProof;
  shortCode: string;
  contractAddress: Hex;
}) => {
  const { id, diskSpace } = (await publicClient.readContract({
    address: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode", // Change to `floppyDisks` in case of getting by id
    args: [shortCode],
  })) as IOnChainFloppy;

  // new floppy starts at 1, so if id is 0, floppy is not found
  if (Number(id) === 0) {
    return throwError({
      code: 404,
      message: "Floppy not found",
    });
  }

  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "claimFloppy",
    args: [id, proof],
  });

  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
      data: encodedCallData,
    },
    1000000
  );

  if (!userOp.success) {
    return throwError({
      code: 500,
      message: "Failed to claim floppy",
    });
  }

  await addStorage({
    contractAddress: contractAddress as string,
    diskSpace: Number(diskSpace),
    shortCode,
  });

  return true;
};
