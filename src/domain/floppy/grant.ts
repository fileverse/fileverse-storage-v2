import { FLOPPY_CONTRACT_ABI } from "../../data/floppyContractAbi";
import { publicClient } from "../contract/viemClient";
import { config } from "../../config";
import { encodeFunctionData, Hex } from "viem";
import { AgentInstance } from "../../infra/smart-agent";
import { throwError } from "../../infra/errorHandler";
import { IOnChainFloppy } from "../../types";
import { hexToBigInt } from "viem";
//
// TODO: Remove this function and use the floppyManager instead
export const grant = async ({
  commitment,
  shortCode,
}: {
  commitment: Hex;
  shortCode: string;
}) => {
  const { id } = (await publicClient.readContract({
    address: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode",
    args: [shortCode],
  })) as IOnChainFloppy;

  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "grantFloppy",
    args: [id, [hexToBigInt(commitment)]],
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

  return true;
};
