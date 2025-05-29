import dotenv from "dotenv";

dotenv.config();
const config = process.env;

config.SERVICE_NAME = config.SERVICE_NAME || "storage-service";

export { config };
