import { config } from "../config";
import axios from "axios";

async function reportError(message: string) {
  const env = config.HOST ? config.HOST : "local";
  const slackHook = config.SLACK_REPORTER as string;
  if (env !== "local") {
    await axios.post(slackHook, {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "*Error* ```" +
              message +
              "```\n*Environment:* " +
              env.toUpperCase(),
          },
        },
      ],
    });
  }
}

export { reportError };
