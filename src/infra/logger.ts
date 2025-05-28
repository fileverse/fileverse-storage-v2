import bunyan from "bunyan";
import { config } from "../config";

export const logger = bunyan.createLogger({
  name: config.SERVICE_NAME as string,
  streams: [
    {
      level: "debug",
      stream: process.stdout,
    },
    {
      type: "rotating-file",
      level: "info",
      path: `logs/${config.SERVICE_NAME}-debug.log`,
      period: "1d", // daily rotation
      count: 10, // keep 10 back copies
    },
    {
      type: "rotating-file",
      level: "error",
      path: `logs/${config.SERVICE_NAME}-error.log`,
      period: "1d", // daily rotation
      count: 10, // keep 10 back copies
    },
  ],
});
