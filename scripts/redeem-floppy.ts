import { config } from "../src/config";
import { Hex } from "viem";

import { Identity } from "@semaphore-protocol/identity";
import { generateProof } from "@semaphore-protocol/proof";
import { Group } from "@semaphore-protocol/group";
import { FloppyManager } from "../src/domain/floppy/floppyManager";
import { AgentInstance } from "../src/infra/smart-agent";

const { FLOPPY_CONTRACT_ADDRESS, SEMAPHORE_CONTRACT_ADDRESS } = config as {
  FLOPPY_CONTRACT_ADDRESS: Hex;
  SEMAPHORE_CONTRACT_ADDRESS: Hex;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const redeemFloppy = async () => {
  await AgentInstance.initializeAgentClient();
  const floppyManager = new FloppyManager("DEVCONNECT25");

  const identity = new Identity();
  const { commitment } = identity;

  const claim = await floppyManager.claimFloppy(commitment.toString());
  console.log("claim", claim);
  await sleep(30000); // 30 seconds

  const groupMembers = await floppyManager.getGroup();
  console.log("groupMembers", groupMembers.members.length);
  const group = new Group(groupMembers.members);
  const scope = new TextEncoder().encode("docs.fileverse.io");
  const message = "Redeem DEVCONNECT25";

  const proof = await generateProof(identity, group, message, scope);

  const redeem = await floppyManager.redeemFloppy(
    proof,
    FLOPPY_CONTRACT_ADDRESS
  );
  console.log("redeem", redeem);
};

redeemFloppy()
  .catch(console.error)
  .finally(() => {
    process.exit(0);
  });
