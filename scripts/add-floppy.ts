import { AgentInstance } from "../src/infra/smart-agent";

import { config } from "../src/config";
import { FLOPPY_CONTRACT_ABI } from "../src/data/floppyContractAbi";
import { encodeFunctionData, Hex, parseEventLogs } from "viem";
import { publicClient } from "../src/domain/contract/viemClient";
import { Floppy } from "../src/infra/database/models";

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
  shortCode: "DAPPCON26",
  diskSpace: 10000000000, // 10 GB
  metadataURI:
    "ipfs://QmVWo7emSDTzEuHtP3hg7m9Ry2GBwamGgfj4BLPRuJzmJL",
  maxCount: 2000,
  name: `DappCon 2026`,
  description: 'Forked from the future, handed to you in Berlin! This floppy disk is a small Fileverse collectable with 10 GB of e2e encrypted storage on ddocs for you to try a new kind of private collaboration, built on Ethereum/Gnosis :yellow_heart:',
  img: "https://s3.eu-west-2.amazonaws.com/assets.fileverse.io/dapp/public/dappcon-floppy.png",
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
    1000000
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
