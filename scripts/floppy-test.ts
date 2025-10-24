import { AgentInstance } from "../src/infra/smart-agent";

import { config } from "../src/config";
import { FLOPPY_CONTRACT_ABI } from "../src/data/floppyContractAbi";
import { encodeFunctionData, Hex, parseEventLogs } from "viem";
import { publicClient } from "../src/domain/contract/viemClient";
import { Identity } from "@semaphore-protocol/identity";

const { FLOPPY_CONTRACT_ADDRESS } = config as { FLOPPY_CONTRACT_ADDRESS: Hex };

interface IFloppy {
  id: bigint;
  shortCode: string;
  groupId: bigint;
  maxCount: bigint;
  diskSpace: bigint;
  grantCount: bigint;
  metadataURI: string;
}

export const addFloppy = async () => {
  await AgentInstance.initializeAgentClient();

  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addFloppy",
    args: [
      "oxTestOne",
      1000,
      1000,
      "ipfs://somecid",
      ["0x060910aE5eDD193990760e76001c8B48e9C6EBB1"],
    ],
  });

  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: FLOPPY_CONTRACT_ADDRESS,
      data: encodedCallData,
    },
    1000000
  );

  console.log(userOp);

  const parsedLog = parseEventLogs({
    abi: FLOPPY_CONTRACT_ABI,
    logs: userOp.receipt.logs,
    eventName: "FloppyCreated",
  });

  console.log(parsedLog[0]);
  return parsedLog[0];
};

const grantFloppy = async () => {
  await AgentInstance.initializeAgentClient();

  const { id } = (await publicClient.readContract({
    address: FLOPPY_CONTRACT_ADDRESS,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode",
    args: ["oxTestOne"],
  })) as IFloppy;

  const { commitment, privateKey } = new Identity();
  console.log("privateKey", privateKey);
  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "grantFloppy",
    args: [id, [commitment]],
  });
  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: FLOPPY_CONTRACT_ADDRESS,
      data: encodedCallData,
    },
    1000000
  );

  console.log(userOp);

  const parsedLog = parseEventLogs({
    abi: FLOPPY_CONTRACT_ABI,
    logs: userOp.receipt.logs,
    eventName: "FloppyGranted",
  });

  console.log(parsedLog[0]);
  return parsedLog[0];
};

grantFloppy().then(() => {
  process.exit(0);
});
