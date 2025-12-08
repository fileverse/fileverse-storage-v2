import * as fs from "fs";
import * as path from "path";
import { FloppyManager } from "../src/domain/floppy/floppyManager";
import { AgentInstance } from "../src/infra/smart-agent";

type Commitment = { commitment: string; seed: string };

const readCommitmentsFromCsv = (filename: string): Commitment[] => {
  const filePath = path.join(__dirname, filename);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");
  const [, ...dataLines] = lines;

  return dataLines.map((line) => {
    const [commitment, seed] = line.split(",");
    return { commitment, seed };
  });
};

const grantFloppy = async () => {
  await AgentInstance.initializeAgentClient();
  const commitments = readCommitmentsFromCsv("commitments.csv");
  const floppyManager = new FloppyManager("TESTCRC");
  for (const { commitment } of commitments) {
    const grant = await floppyManager.claimFloppy(commitment);
    console.log(
      `Grant ${grant ? "success" : "failed"} for commitment ${commitment}`
    );
  }
};

grantFloppy().then(() => process.exit(0));
