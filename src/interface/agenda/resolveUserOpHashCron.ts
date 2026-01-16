import { agenda } from ".";
import { logger } from "../../infra/logger";
import resolveUserOpHash from "./jobs/resolveUserOpHash";

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

(async function () {
  try {
    await agenda.start();
    await resolveUserOpHash.setupJob();
  } catch (err) {
    logger.error(err);
    await graceful();
  }
})();

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
