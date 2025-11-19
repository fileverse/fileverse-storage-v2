import axios from "axios";
import { config } from "../../config";
import { publicClient } from "../contract/viemClient";
import { Hex } from "viem";

const SEMAPHORE_SUBGRAPH_URL = config.SEMAPHORE_SUBGRAPH_URL as string;
const SEMAPHORE_CONTRACT_ADDRESS = config.SEMAPHORE_CONTRACT_ADDRESS as Hex;

export const getGroupMembers = async (groupId: string) => {
  const size = await getMerkleTreeSize(groupId);

  const data = JSON.stringify({
    query: `{\n  groups(where: {id: "${groupId}"}) {\n    members(first: ${size}) {\n      identityCommitment\n    }\n  }\n}`,
    extensions: {},
  });
  const config = {
    url: SEMAPHORE_SUBGRAPH_URL,
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    data: data,
  };
  const response = await axios.request(config);

  const members = response?.data?.data?.groups[0]?.members?.map(
    (member: any) => member.identityCommitment
  );
  return members ?? [];
};

export const getMerkleTreeSize = async (groupId: string) => {
  const size = await publicClient.readContract({
    address: SEMAPHORE_CONTRACT_ADDRESS,
    abi: [
      {
        inputs: [{ internalType: "uint256", name: "groupId", type: "uint256" }],
        name: "getMerkleTreeSize",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getMerkleTreeSize",
    args: [BigInt(groupId)],
  });

  return size.toString();
};
