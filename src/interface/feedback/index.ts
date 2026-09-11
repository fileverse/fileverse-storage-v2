import { ErrorRequestHandler, Router } from "express";
import { ValidationError } from "express-validation";
import { asyncHandler, asyncHandlerArray } from "../../infra/asyncHandler";
import { feedbackRateLimit } from "./rateLimit";
import report from "./report";

const router = Router();

router.post("/report", asyncHandler(feedbackRateLimit), asyncHandlerArray(report));

// Validation failures on this open endpoint answer 400 here so they never
// reach the app-level handler, which posts every error to Slack.
const validationErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof ValidationError) {
    res.status(400).json({ message: err.message, details: err.details });
    return;
  }
  next(err);
};

router.use(validationErrorHandler);

export default router;
