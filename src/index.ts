import { config } from "./config";
import { logger } from "./infra/logger";
import app from "./app";
import { AgentInstance } from "./infra/smart-agent";

// Here you set the PORT and IP of the server
const port = config.PORT || 8001;
const ip = config.IP || "127.0.0.1";

// Start the server
app.listen({ port, ip }, async () => {
  await AgentInstance.initializeAgentClient();
  logger.info("Agent client initialized");
  logger.info(`🚀 Server ready at http://${ip}:${port}`);
});

module.exports = app;
