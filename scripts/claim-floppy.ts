import { config } from "../src/config";
import { FLOPPY_CONTRACT_ABI } from "../src/data/floppyContractAbi";
import { Hex, toHex } from "viem";
import { publicClient } from "../src/domain/contract/viemClient";

import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { SemaphoreViem } from "@semaphore-protocol/data";
import { Group } from "@semaphore-protocol/group";

// NOTE: Subgraph api is not working as expected
// const semaphoreSubgraph = new SemaphoreSubgraph("sepolia");

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

const DUMMY_SEED = "DumDummyTwo";

const SHORT_CODE = "oxTestThree";

const SEMAPHORE_CONTRACT_ADDRESS = "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D"; // sepolia

const grantFloppy = async () => {
  const { commitment } = new Identity(DUMMY_SEED);
  console.log(toHex(commitment));
  const response = await fetch("http://localhost:8001/floppy/grant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      commitment: toHex(commitment),
      shortCode: SHORT_CODE,
    }),
  });
  const responseData = await response.json();
  console.log("Grant response: ", responseData);
};

const claimFloppy = async () => {
  const { groupId } = (await await publicClient.readContract({
    address: FLOPPY_CONTRACT_ADDRESS,
    abi: FLOPPY_CONTRACT_ABI,
    functionName: "getFloppyByShortCode",
    args: [SHORT_CODE],
  })) as IFloppy;

  const semaphoreViemOnSepolia = new SemaphoreViem("sepolia", {
    address: SEMAPHORE_CONTRACT_ADDRESS,
    startBlock: 9504370n, // start block if exceeds ten thousand blocks this breaks,create a new floppy and update the start block
    //   @ts-ignore
    publicClient: publicClient,
  });

  const groupMembers = await semaphoreViemOnSepolia.getGroupMembers(
    groupId.toString()
  );

  const group = new Group(groupMembers);
  const scope = group.root;

  const message = `Claim-${SHORT_CODE}`;

  const identity = new Identity(DUMMY_SEED);

  const proof = await generateProof(identity, group, message, scope);

  const apiResponse = await fetch(
    "http://localhost:8001/floppy/claim-onchain",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        chain: "11155111",
        contract: "", // add the contract address here
        invoker: "", // add the invoker address here
        Authorization: "", // add the authorization token here
      },
      body: JSON.stringify({
        proof,
        shortCode: SHORT_CODE,
      }),
    }
  );

  const apiResponseData = await apiResponse.json();
  console.log("Claim response: ", apiResponseData);
};

grantFloppy()
  .then(async () => await claimFloppy())
  .catch(console.error)
  .finally(() => process.exit(0));
