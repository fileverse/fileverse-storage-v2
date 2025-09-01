import { publicClient } from "./viemClient";
import { portalAbi } from "./abi";
import { legacyPortalContractAbi } from "./legacy-portal-contract-abi";
import { Hex, zeroAddress } from "viem";
import { config } from "../../config";

const getCollaboratorKeys = async (
  collaboratorAddress: Hex,
  portalAddress: Hex
) => {
  try {
    const result = (await publicClient.readContract({
      address: portalAddress,
      abi: portalAbi,
      functionName: "collaboratorKeys",
      args: [collaboratorAddress],
    })) as string;

    return result;
  } catch (err) {
    console.error(err);
    return null;
  }
};

const getLegacyCollaboratorKeys = async (
  collaboratorAddress: Hex,
  portalAddress: Hex
) => {
  try {
    const result =
      ((await publicClient.readContract({
        address: portalAddress,
        abi: legacyPortalContractAbi,
        functionName: "collaboratorKeys",
        args: [collaboratorAddress],
      })) as [string, string]) || [];

    return result[1];
  } catch (err) {
    console.error(err);
    return null;
  }
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

const isLegacyContract = async (contractAddress: Hex) => {
  const result = await publicClient.readContract({
    address: config.LEGACY_PORTAL_REGISTRY_ADDRESS as Hex,
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "_portal",
            type: "address",
          },
        ],
        name: "ownerOf",
        outputs: [
          {
            internalType: "address",
            name: "",
            type: "address",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "ownerOf",
    args: [contractAddress],
  });
  return result !== zeroAddress;
};

export {
  getCollaboratorKeys,
  getFileIdByAppFileId,
  getLegacyCollaboratorKeys,
  isLegacyContract,
};
