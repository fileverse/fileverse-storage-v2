import dotenv from "dotenv";

dotenv.config();
const config = process.env;

config.SERVICE_NAME = config.SERVICE_NAME || "storage-service";
config.ALLOWED_ORIGINS =
  config.ALLOWED_ORIGINS || "https://sheets.fileverse.io";

export { config };
