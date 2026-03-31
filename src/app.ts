import express from "express";
import logger from "morgan";
import cors from "cors";
import helmet from "helmet";

import router from "./interface";
import v2Router from "./interface/v2";
import webhookRouter from "./interface/webhook";
import { expressErrorHandler } from "./interface/middleware";
import { asyncHandler } from "./infra/asyncHandler";
import { verify } from "./infra/ucan";
import { verifyV2 } from "./infra/ucanV2";

// Express App
const app = express();
app.set("etag", false);
// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// parse application/json
app.use(express.json());

// Use default logger for now
app.use(logger("combined"));
app.use(
  cors({
    origin: "*",
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false,
  })
);

// This /webhook route has a separate auth check
app.use("/webhook", webhookRouter);
app.use("/ping", function (req, res) {
  res.json({ reply: "pong" });
  res.end();
});

app.use("/api/v2", asyncHandler(verifyV2), v2Router);
app.use("/", asyncHandler(verify), router);

app.use(expressErrorHandler as express.ErrorRequestHandler);

// Export the express app instance
export default app;
