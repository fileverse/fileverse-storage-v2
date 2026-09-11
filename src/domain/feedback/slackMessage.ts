export interface FeedbackSlackInput {
  topic: string;
  feedback: string;
  contactPreference: string;
  wantContact: boolean;
  isLLMRequest: boolean;
  source: string;
  app: string;
}

// Document identifiers are stored in Mongo only. The Slack payload is built
// from this explicit field list so they can never be forwarded by accident.
export const pickSlackFields = (
  row: FeedbackSlackInput & Record<string, unknown>
): FeedbackSlackInput => ({
  topic: row.topic,
  feedback: row.feedback,
  contactPreference: row.contactPreference,
  wantContact: row.wantContact,
  isLLMRequest: row.isLLMRequest,
  source: row.source,
  app: row.app,
});

// Slack mrkdwn treats & < > as markup (mentions, links); user text must not.
const escapeMrkdwn = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A Slack section holds at most 3000 characters. Feedback may be 5000, so the
// notice is clipped; the stored row keeps the full text.
export const SLACK_FEEDBACK_MAX = 2500;
const SLACK_CONTACT_MAX = 300;
const TRUNCATED_MARK = " (truncated)";
const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}${TRUNCATED_MARK}` : text;

const slackFeedbackText = (feedback: string): string =>
  clip(escapeMrkdwn(feedback), SLACK_FEEDBACK_MAX);

type SlackBlock = { type: string; text: { type: string; text: string } };

export const buildFeedbackSlackBlocks = (
  input: FeedbackSlackInput
): SlackBlock[] => {
  const originLine = `*Source:* ${input.source} · *App:* ${input.app}`;

  if (input.isLLMRequest) {
    return [
      {
        type: "header",
        text: { type: "plain_text", text: "A user wants to add a new LLM" },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${slackFeedbackText(input.feedback)}\n\n${originLine}`,
        },
      },
    ];
  }

  const lines = [
    `*Topic:*\n${input.topic || "General"}`,
    originLine,
    `*Feedback:*\n${slackFeedbackText(input.feedback)}`,
  ];
  if (input.wantContact && input.contactPreference) {
    lines.push(
      `User asked to be contacted for this feedback on *${clip(escapeMrkdwn(input.contactPreference), SLACK_CONTACT_MAX)}*`
    );
  }

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "New feedback on dDocs" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: lines.join("\n\n") },
    },
  ];
};
