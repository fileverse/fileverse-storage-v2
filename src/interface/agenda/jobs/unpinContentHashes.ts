import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { File,Limit } from "../../../infra/database/models";
import { FileIPFSType } from "../../../types";
import { unpin } from "../../../domain";
import { updatePinningStatus } from "../../../domain/file/updatePinningStatus";
const JOB_NAME = "UNPIN_CONTENT_HASH_CRON";

const MAX_UNPIN_COUNT = 100;

async function jobDefinition(job: Job, done: (args?: any) => void) {
  try {
    logger.info(`Job ${JOB_NAME} started`);
    await unpinContentHashes();
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

async function unpinContentHashes() {
  const files = await File.find({
    isPinned: true,
    isDeleted: false,
    ipfsType: FileIPFSType.CONTENT,
    markedForUnpin: true,
  }).limit(MAX_UNPIN_COUNT);

  logger.info(`Unpinning ${files.length} content hashes`);
  for (const file of files) {
    const mongoObjectId = file._id.toString();
    try {
      if (file.ipfsHash) {
        await unpin(file.ipfsHash);
        await updatePinningStatus(mongoObjectId, false);
        if (typeof file.fileSize === "number") {// this check is important cuz filesize is not set as required to typescript complains but evry CONTENT record does have a filesize
            await Limit.updateOne(
                { contractAddress: file.contractAddress },
                { $inc: { storageUse: -file.fileSize } }
            );
        }
        logger.info(`Unpinned ${file.ipfsHash}`);
      }
    } catch (error: any) {
      if (error && error.reason === "CURRENT_USER_HAS_NOT_PINNED_CID") {
        await updatePinningStatus(mongoObjectId, false);
        if (typeof file.fileSize === "number") {// what if file already removed from pinata, we need to handle storage use decrement
            await Limit.updateOne(
                { contractAddress: file.contractAddress },
                { $inc: { storageUse: -file.fileSize } }
            );
        }
        logger.info(
          `Updated DB State only for ${file.ipfsHash}, because already unpinned`
        );
      } else {
        logger.error(`Error unpinning ${file.ipfsHash}:`, error);
      }
    }
  }
}

export default { setupJob, jobDefinition };
