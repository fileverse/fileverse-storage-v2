import axios from "axios";
import { config } from "../../config";
import { logger } from "../../infra/logger";
import { Feedback } from "../../infra/database/models";
import type { FeedbackRequestBody } from "../../interface/feedback/schema";
import { buildFeedbackSlackBlocks, pickSlackFields } from "./slackMessage";

export const postFeedbackToSlack = async (
  blocks: ReturnType<typeof buildFeedbackSlackBlocks>
): Promise<boolean> => {
  const webhook = config.SLACK_FEEDBACK_WEBHOOK;
  if (!webhook) {
    logger.warn("SLACK_FEEDBACK_WEBHOOK is not set; feedback stored without Slack notice");
    return false;
  }
  try {
    await axios.post(webhook, { blocks }, { timeout: 5000 });
    return true;
  } catch (error) {
    logger.error(`feedback slack post failed: ${error}`);
    return false;
  }
};

export const reportFeedback = async (
  input: FeedbackRequestBody
): Promise<{ id: string; slackDelivered: boolean }> => {
  const row = await Feedback.create({
    topic: input.topic || "General",
    feedback: input.feedback.trim(),
    contactPreference: input.contactPreference ?? "",
    wantContact: input.wantContact,
    isLLMRequest: input.isLLMRequest,
    source: input.source,
    app: input.app,
    ddocId: input.ddocId,
    dsheetId: input.dsheetId,
    portalAddress: input.portalAddress?.toLowerCase(),
    slackDelivered: false,
  });

  const slackDelivered = await postFeedbackToSlack(
    buildFeedbackSlackBlocks(pickSlackFields(row.toObject()))
  );
  if (slackDelivered) {
    row.slackDelivered = true;
    // The row is already stored and Slack already notified; a failure to
    // persist the flag must not fail the request.
    try {
      await row.save();
    } catch (err) {
      logger.warn(`feedback slackDelivered flag not persisted: ${err}`);
    }
  }

  return { id: String(row._id), slackDelivered };
};
