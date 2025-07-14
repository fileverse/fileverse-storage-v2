import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { File } from "../../../infra/database/models";
import { FileIPFSType } from "../../../types";
import { unpin } from "../../../domain";
import { updatePinningStatus } from "../../../domain/file/updatePinningStatus";

const JOB_NAME = "UNPIN_DELETED_FILE_HASH_CRON";

const MAX_BATCH_SIZE = 100;

async function jobDefinition(job: Job, done: (args?: any) => void) {
  try {
    logger.info(`Job ${JOB_NAME} started`);
    await unpinDeletedFileHashes();
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

async function unpinDeletedFileHashes() {
  const files = await File.find({
    isPinned: true,
    isDeleted: true,
    markedForUnpin: true,
  }).limit(MAX_BATCH_SIZE);

  logger.info(`Unpinning ${files.length} deleted file hashes`);

  for (const file of files) {
    const mongoObjectId = file._id.toString();
    try {
      if (file.ipfsHash) {
        await unpin(file.ipfsHash);
        await updatePinningStatus(mongoObjectId, false);
        logger.info(`Unpinned ${file.ipfsHash}`);
      }
    } catch (error: any) {
      if (error && error.reason === "CURRENT_USER_HAS_NOT_PINNED_CID") {
        await updatePinningStatus(mongoObjectId, false);
        logger.info(
          `Updated DB State only for ${file.ipfsHash}, because already unpinned`
        );
      }
    }
  }
}

export default { setupJob, jobDefinition };
