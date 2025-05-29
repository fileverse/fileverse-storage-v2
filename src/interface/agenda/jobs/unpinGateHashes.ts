import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { File } from "../../../infra/database/models";
import { FileIPFSType } from "../../../types";
import { unpin } from "../../../domain";
const JOB_NAME = "UNPIN_GATE_HASH_CRON";

const MAX_UNPIN_COUNT = 100;

async function jobDefinition(job: Job, done: (args?: any) => void) {
  try {
    logger.info(`Job ${JOB_NAME} started`);
    await unpinGateHashes();
    logger.info(`Job ${JOB_NAME} completed`);
    done();
  } catch (error) {
    logger.error(`Error in ${JOB_NAME} job:`, error);
    done(error);
  }
}

async function setupJob() {
  agenda.define(JOB_NAME, jobDefinition);
  agenda.every("1 minute", JOB_NAME);
}

async function unpinGateHashes() {
  try {
    const files = await File.find({
      isPinned: true,
      isDeleted: false,
      ipfsType: FileIPFSType.GATE,
      markedForUnpin: true,
    }).limit(MAX_UNPIN_COUNT);

    logger.info(`Unpinning ${files.length} gate hashes`);
    for (const file of files) {
      if (file.ipfsHash) {
        await unpin(file.ipfsHash);
        await File.updateOne({ _id: file._id }, { $set: { isPinned: false } });
        logger.info(`Unpinned ${file.ipfsHash}`);
      }
    }
  } catch (error) {
    logger.error(`Error in unpinGateHashes:`, error);
  }
}

export default { setupJob, jobDefinition };
