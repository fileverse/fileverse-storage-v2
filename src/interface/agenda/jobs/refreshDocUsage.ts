import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { reportError } from "../../../infra/reporter";
import { processDirtyRows } from "../../../domain/limit";

const JOB_NAME = "REFRESH_DOC_USAGE";
const BATCH_SIZE = 200;
const ALERT_AFTER_FAILED_TICKS = 5;

let failedTicks = 0;

async function jobDefinition(job: Job, done: (args?: unknown) => void) {
  try {
    const result = await processDirtyRows({ limit: BATCH_SIZE });
    const { processed, skipped, failed, portals } = result;
    if (processed || skipped || failed || portals) {
      logger.info({ job: JOB_NAME, ...result }, "doc usage refresh tick");
    }
    failedTicks = 0;
    done();
  } catch (error) {
    // A tick that fails outright leaves every counter frozen, so say so
    // once it is clearly not a blip.
    failedTicks += 1;
    logger.error(`Error in ${JOB_NAME} job:`, error);
    if (failedTicks === ALERT_AFTER_FAILED_TICKS) {
      const message = error instanceof Error ? error.message : String(error);
      await reportError(
        `${JOB_NAME} has failed ${failedTicks} ticks in a row: ${message}`
      ).catch(() => undefined);
    }
    done(error);
  }
}

async function setupJob() {
  // Portal sums are only correct with a single runner; pin it here rather
  // than relying on the shared agenda defaults.
  agenda.define(JOB_NAME, { concurrency: 1, lockLimit: 1 }, jobDefinition);
  agenda.every("5 seconds", JOB_NAME);
}

export default { setupJob, jobDefinition };
