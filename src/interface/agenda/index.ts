import { Agenda } from "agenda";
import { config } from "../../config";
import { logger } from "../../infra/logger";

const agenda = new Agenda({
  db: { address: config.MONGOURI as string },
  defaultConcurrency: Number(config.AGENDA_CONCURRENCY) || 1,
  defaultLockLimit: Number(config.AGENDA_LOCK_LIMIT) || 1,
});

agenda.on("start", (job) => {
  logger.info(`Job ${job.attrs.name} starting`);
});

agenda.on("complete", (job) => {
  logger.info(`Job ${job.attrs.name} finished`);
});

export { agenda };
