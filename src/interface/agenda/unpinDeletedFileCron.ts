import { agenda } from ".";
import { logger } from "../../infra/logger";
import unpinDeletedFileHashes from "./jobs/unpinDeletedFileHashes";

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

(async function () {
  try {
    await agenda.start();
    await unpinDeletedFileHashes.setupJob();
  } catch (err) {
    logger.error(err);
    await graceful();
  }
})();

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
