import { publicClient } from "./viemClient";
import { portalAbi } from "./abi";
import { Hex } from "viem";

const getCollaboratorKeys = async (
  collaboratorAddress: Hex,
  portalAddress: Hex
) => {
  const result = (await publicClient.readContract({
    address: portalAddress,
    abi: portalAbi,
    functionName: "collaboratorKeys",
    args: [collaboratorAddress],
  })) as string;

  return result;
};

export { getCollaboratorKeys };
