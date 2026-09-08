import dotenv from "dotenv";

dotenv.config();
const config = process.env;

config.SERVICE_NAME = config.SERVICE_NAME || "storage-service";
config.ALLOWED_ORIGINS =
  config.ALLOWED_ORIGINS || "https://sheets.fileverse.io";

config.LEGACY_PORTAL_REGISTRY_ADDRESS =
  config.LEGACY_PORTAL_REGISTRY_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

config.LEGACY_STORAGE_BACKEND = config.LEGACY_STORAGE_BACKEND || "";

config.WORKSPACE_STATUS_TTL = process.env.WORKSPACE_STATUS_TTL ?? "86400";
config.IDENTITY_INDEXER_TIMEOUT_MS =
  process.env.IDENTITY_INDEXER_TIMEOUT_MS ?? "2000";

export { config };
