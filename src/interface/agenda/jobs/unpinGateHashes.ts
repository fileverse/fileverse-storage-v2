import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { File } from "../../../infra/database/models";
import { FileIPFSType } from "../../../types";
import { unpin, unpinPublic, unpinPrivate } from "../../../domain";
import { updatePinningStatus } from "../../../domain/file/updatePinningStatus";
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
  const files = await File.find({
    isPinned: true,
    isDeleted: false,
    ipfsType: FileIPFSType.GATE,
    markedForUnpin: true,
  }).limit(MAX_UNPIN_COUNT);

  logger.info(`Unpinning ${files.length} gate hashes`);
  for (const file of files) {
    const mongoObjectId = file._id.toString();
    try {
      if (file.storageType === "pinata-private") {
        if (file.pinataId) {
          await unpinPrivate(file.pinataId);
          await updatePinningStatus(mongoObjectId, false);
          logger.info(`Deleted private ${file.ipfsHash}`);
        } else {
          // No stored Pinata id (pre-fix upload) — undeletable via API;
          // mark unpinned so the cron doesn't retry it forever.
          await updatePinningStatus(mongoObjectId, false);
          logger.error(
            `Private file ${file.ipfsHash} has no pinataId; cannot delete`
          );
        }
      } else if (file.pinataId) {
        // Public row created via the Files API: delete by file id.
        await unpinPublic(file.pinataId);
        await updatePinningStatus(mongoObjectId, false);
        logger.info(`Deleted public ${file.ipfsHash}`);
      } else if (file.ipfsHash) {
        // Pre-migration public row: legacy unpin-by-CID.
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
      } else {
        logger.error(`Error unpinning ${file.ipfsHash}:`, error);
      }
    }
  }
}

export default { setupJob, jobDefinition };
