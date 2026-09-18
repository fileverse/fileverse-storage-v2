import { agenda } from ".";
import { logger } from "../../infra/logger";
import refreshDocUsage from "./jobs/refreshDocUsage";

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

(async function () {
  try {
    await agenda.start();
    await refreshDocUsage.setupJob();
  } catch (err) {
    logger.error(err);
    await graceful();
  }
})();

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
