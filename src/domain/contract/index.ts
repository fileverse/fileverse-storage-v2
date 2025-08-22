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

const getFileIdByAppFileId = async (appFileId: string, portalAddress: Hex) => {
  const result = (await publicClient.readContract({
    address: portalAddress,
    abi: portalAbi,
    functionName: "appFileIdToFileId",
    args: [appFileId],
  })) as bigint;

  return result.toString();
};

export { getCollaboratorKeys, getFileIdByAppFileId };
