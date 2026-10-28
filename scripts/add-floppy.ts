import { AgentInstance } from "../src/infra/smart-agent";

import { config } from "../src/config";
import { FLOPPY_CONTRACT_ABI } from "../src/data/floppyContractAbi";
import { encodeFunctionData, Hex, parseEventLogs } from "viem";
import { publicClient } from "../src/domain/contract/viemClient";
import { Floppy } from "../src/infra/database/models";
import { FLOPPY_WRITE_CALL_GAS_LIMIT } from "../src/domain/floppy/floppyManager";

const { FLOPPY_CONTRACT_ADDRESS, MANAGER_CONTRACT_ADDRESS } = config as {
  FLOPPY_CONTRACT_ADDRESS: Hex;
  MANAGER_CONTRACT_ADDRESS: Hex;
};

interface IFloppy {
  id: bigint;
  shortCode: string;
  groupId: bigint;
  maxCount: bigint;
  diskSpace: bigint;
  grantCount: bigint;
  metadataURI: string;
}

const FLOPPY = {
  shortCode: "DEVCON8",
  diskSpace: 10000000000, // 10 GB
  metadataURI:
    "ipfs://Qmcir4jeXLW6bfYxQSc2qVrZ1g4GUB76yJd2R3savaw2iJ",
  maxCount: 1000,
  name: `Devcon VIII Volunteer`,
  description: `If you read this message, you're the lucky owner of a private Devcon Volunteer Floppy! This one-of-a-kind collectable was made by team Devcon and Fileverse for all the Volunteers that made Devcon VIII India a reality. Tucked inside are 10 GB of private storage and a secret that’s yours alone, revealed in early 2027 💜\n\n👩‍🏭 Don't hesitate to chat with the Fileverse team via the feedback button if there's anything you'd like to learn about us or a key feature you'd like to add.`,
  img: "https://apps-ipfs.fileverse.io/ipfs/QmYpYkU4Ex4ynx2WXUqE1Y9AauPZsgUc2iSraHNKAQZpgn",
  offchain: false,
  supportsMultipleClaims: false,
};

const addFloppy = async () => {
  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addFloppy",
    args: [
      FLOPPY.shortCode,
      FLOPPY.maxCount,
      FLOPPY.diskSpace,
      FLOPPY.metadataURI,
      [AgentInstance.getAgentAddress(), MANAGER_CONTRACT_ADDRESS],
    ],
  });

  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: FLOPPY_CONTRACT_ADDRESS,
      data: encodedCallData,
    },
    1000000,
    FLOPPY_WRITE_CALL_GAS_LIMIT
  );

  const parsedLog = parseEventLogs({
    abi: FLOPPY_CONTRACT_ABI,
    logs: userOp.receipt.logs,
    eventName: "FloppyCreated",
  });

  console.log(parsedLog[0]);
  return parsedLog[0];
};

const addOperator = async () => {
  const floppy = (await publicClient.readContract({
    address: FLOPPY_CONTRACT_ADDRESS,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode",
    args: [FLOPPY.shortCode],
  })) as IFloppy;

  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addOperator",
    args: [AgentInstance.getAgentAddress()],
  });

  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: FLOPPY_CONTRACT_ADDRESS,
      data: encodedCallData,
    },
    1000000
  );

  if (!userOp.success) {
    console.error(userOp);
    throw new Error("Failed to add operator");
  }
  return floppy;
};

const main = async () => {
  await AgentInstance.initializeAgentClient();

  await addFloppy();
  const floppy = await addOperator();
  const dbFloppy = new Floppy({
    shortCode: FLOPPY.shortCode,
    description: FLOPPY.description,
    diskSpace: Number(floppy.diskSpace),
    img: FLOPPY.img,
    metadataURI: FLOPPY.metadataURI,
    members: [],
    nullifiers: [],
    offchain: FLOPPY.offchain,
    networkName: config.NETWORK,
    sgid: floppy.groupId.toString(),
    name: FLOPPY.name,
    onChainFloppyId: floppy.id.toString(),
    supportsMultipleClaims: FLOPPY.supportsMultipleClaims,
  });
  await dbFloppy.save();

  console.log(`Floppy ${FLOPPY.shortCode} added to database`);
};

main().then(() => {
  process.exit(0);
});
