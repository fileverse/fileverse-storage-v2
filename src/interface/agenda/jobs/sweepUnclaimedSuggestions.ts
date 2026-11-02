import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { sweepUnclaimedSuggestions } from "../../../domain/suggestion";

const JOB_NAME = "SWEEP_UNCLAIMED_SUGGESTIONS_CRON";

async function jobDefinition(_job: Job, done: (args?: any) => void) {
  try {
    const swept = await sweepUnclaimedSuggestions(Date.now());
    logger.info(`Job ${JOB_NAME} marked ${swept} unclaimed suggestions for unpin`);
    done();
  } catch (error) {
    logger.error(`Error in ${JOB_NAME} job:`, error);
    done(error);
  }
}

async function setupJob() {
  agenda.define(JOB_NAME, jobDefinition);
  agenda.every("15 minutes", JOB_NAME);
}

export default { setupJob, jobDefinition };
