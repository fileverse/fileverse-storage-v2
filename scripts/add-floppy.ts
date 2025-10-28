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

const SHORT_CODE = "0xFloppy-";

const addFloppy = async (shortCode: string) => {
  const encodedCallData = encodeFunctionData({
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "addFloppy",
    args: [
      shortCode,
      1000,
      1000,
      "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
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
    args: [floppy.id, "0x060910aE5eDD193990760e76001c8B48e9C6EBB1"],
  });
  const userOp = await AgentInstance.executeUserOperationRequest(
    {
      contractAddress: FLOPPY_CONTRACT_ADDRESS,
      data: encodedCallData,
    },
    1000000
  );

  console.log(userOp);
  return floppy;
};

const main = async () => {
  await AgentInstance.initializeAgentClient();
  for (let i = 1; i <= 10; i++) {
    const shortCode = `${SHORT_CODE}${i}`;
    await addFloppy(shortCode);
    const floppy = await addOperator(shortCode);
    const dbFloppy = new Floppy({
      shortCode,
      description: `Test floppy ${i}`,
      diskSpace: Number(floppy.diskSpace),
      img: "https://s3.eu-west-2.amazonaws.com/assets.fileverse.io/dapp/public/Oxford+floppy+disk+digital+version+1.jpg",
      metadataURI: floppy.metadataURI,
      members: [],
      nullifiers: [],
      offchain: false,
      networkName: config.NETWORK_NAME,
      sgid: floppy.groupId.toString(),
      name: `Test floppy ${i}`,
      onChainFloppyId: floppy.id.toString(),
    });
    await dbFloppy.save();

    console.log(`Floppy ${shortCode} added to database`);
    console.log(dbFloppy);
  }
};

main().then(() => {
  process.exit(0);
});
