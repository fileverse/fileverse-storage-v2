import { Response } from "express";
import { validate } from "../middleware";
import { CustomRequest } from "../../types";
import { reportFeedback } from "../../domain/feedback";
import { reportValidation, FeedbackRequestBody } from "./schema";

const reportHandler = async (req: CustomRequest, res: Response) => {
  const body = req.body as FeedbackRequestBody;
  await reportFeedback(body);
  res.json({ success: true });
};

export default [validate(reportValidation), reportHandler];
