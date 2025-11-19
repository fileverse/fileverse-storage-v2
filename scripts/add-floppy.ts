import { AgentInstance } from "../src/infra/smart-agent";

import { config } from "../src/config";
import { FLOPPY_CONTRACT_ABI } from "../src/data/floppyContractAbi";
import { encodeFunctionData, Hex, parseEventLogs } from "viem";
import { publicClient } from "../src/domain/contract/viemClient";
import { Floppy } from "../src/infra/database/models";

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

const SHORT_CODE = "DEVCONNECT25";

const addFloppy = async (shortCode: string) => {
  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addFloppy",
    args: [
      shortCode,
      5000,
      5000000000,
      "ipfs://bafkreidt3kel5ro264wtxteil5aqfblzeok3wxucnp3cmeycwv3yxwxa2i",
      [
        "0xfC87C05fa474b8C16A2982f5829163A921D7d091",
        "0xebf6261737a84a6A47CC3Ff40cccfdDd8531f452",
      ],
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

const addOperator = async (shortCode: string) => {
  const floppy = (await publicClient.readContract({
    address: FLOPPY_CONTRACT_ADDRESS,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode",
    args: [shortCode],
  })) as IFloppy;

  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addOperator",
    args: ["0xfC87C05fa474b8C16A2982f5829163A921D7d091"],
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

  const shortCode = SHORT_CODE;
  await addFloppy(shortCode);
  const floppy = await addOperator(shortCode);
  const dbFloppy = new Floppy({
    shortCode,
    description: `Your own Devconnect Argentina 2025 Floppy! A collectible proof of self-sovereignty that comes with 5 GB of  encrypted storage, for you to explore new forms of private, Ethereum-powered collaboration.
Cherish it, there will only be one Devconnect Argentina in 2025 <3`,
    diskSpace: Number(floppy.diskSpace),
    img: "https://apps-ipfs.fileverse.io/ipfs/QmcJcNAnEfdfna6WcxjLLGCmQ9QbpoKp5FTMhrx2WkEF6T",
    metadataURI: floppy.metadataURI,
    members: [],
    nullifiers: [],
    offchain: false,
    networkName: config.NETWORK,
    sgid: floppy.groupId.toString(),
    name: `Devconnect 2025`,
    onChainFloppyId: floppy.id.toString(),
  });
  await dbFloppy.save();

  console.log(`Floppy ${shortCode} added to database`);
};

main().then(() => {
  process.exit(0);
});
