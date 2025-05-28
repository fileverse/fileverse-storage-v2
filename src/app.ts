import express from "express";
import logger from "morgan";
import cors from "cors";
import helmet from "helmet";

import router from "./interface";
import { expressErrorHandler } from "./interface/middleware";
import { asyncHandler } from "./infra/asyncHandler";
import { verify } from "./infra/ucan";

// Express App
const app = express();

// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// parse application/json
app.use(express.json());

// Use default logger for now
app.use(logger("combined"));
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  })
);

app.use(asyncHandler(verify));
// This is to check if the service is online or not
app.use("/ping", function (req, res) {
  res.json({ reply: "pong" });
  res.end();
});

app.use("/", router);

app.use(expressErrorHandler as express.ErrorRequestHandler);

// Export the express app instance
export default app;
