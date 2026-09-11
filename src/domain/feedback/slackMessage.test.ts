import {
  SLACK_FEEDBACK_MAX,
  buildFeedbackSlackBlocks,
  pickSlackFields,
} from "./slackMessage";

const base = {
  topic: "Bug",
  feedback: "The editor froze",
  contactPreference: "@someone",
  wantContact: true,
  isLLMRequest: false,
  source: "viewer-error-screen",
  app: "ddocs",
};

describe("buildFeedbackSlackBlocks", () => {
  it("renders header, topic, source, app, feedback and contact line", () => {
    const blocks = buildFeedbackSlackBlocks(base);
    expect(blocks[0]).toEqual({
      type: "header",
      text: { type: "plain_text", text: "New feedback on dDocs" },
    });
    const body = blocks[1].text.text;
    expect(body).toContain("*Topic:*\nBug");
    expect(body).toContain("*Source:* viewer-error-screen · *App:* ddocs");
    expect(body).toContain("*Feedback:*\nThe editor froze");
    expect(body).toContain(
      "User asked to be contacted for this feedback on *@someone*"
    );
  });

  it("omits the contact line when wantContact is false", () => {
    const body = buildFeedbackSlackBlocks({ ...base, wantContact: false })[1]
      .text.text;
    expect(body).not.toContain("asked to be contacted");
  });

  it("uses the LLM header and raw feedback for LLM requests", () => {
    const blocks = buildFeedbackSlackBlocks({
      ...base,
      topic: "LLM",
      isLLMRequest: true,
      feedback: "gpt-oss",
      wantContact: false,
    });
    expect(blocks[0].text.text).toBe("A user wants to add a new LLM");
    expect(blocks[1].text.text).toBe(
      "gpt-oss\n\n*Source:* viewer-error-screen · *App:* ddocs"
    );
  });

  it("escapes slack markup in user text", () => {
    const body = buildFeedbackSlackBlocks({
      ...base,
      feedback: "<!channel> see <https://evil.example|Support> & co",
      contactPreference: "<@U123>",
    })[1].text.text;
    expect(body).not.toContain("<!channel>");
    expect(body).toContain("&lt;!channel&gt;");
    expect(body).toContain("&amp; co");
    expect(body).toContain("*&lt;@U123&gt;*");
  });

  it("omits the contact line when wantContact is true but no contact was given", () => {
    const body = buildFeedbackSlackBlocks({ ...base, contactPreference: "" })[1]
      .text.text;
    expect(body).not.toContain("asked to be contacted");
  });
});

describe("pickSlackFields", () => {
  it("drops every field that is not on the allow-list", () => {
    const row = {
      ...base,
      ddocId: "SECRET-DDOC",
      dsheetId: "SECRET-SHEET",
      portalAddress: "0xdeadbeef",
      _id: "row-id",
    };
    const picked = pickSlackFields(row);
    expect(picked).toEqual(base);
    const serialized = JSON.stringify(buildFeedbackSlackBlocks(picked));
    expect(serialized).not.toContain("SECRET-DDOC");
    expect(serialized).not.toContain("SECRET-SHEET");
    expect(serialized).not.toContain("0xdeadbeef");
  });

  it("clips long feedback so the section stays under Slack's 3000 limit", () => {
    const long = "&".repeat(5000);
    for (const isLLMRequest of [false, true]) {
      const body = buildFeedbackSlackBlocks({
        ...base,
        isLLMRequest,
        feedback: long,
      })[1].text.text;
      expect(body).toContain("(truncated)");
      expect(body.length).toBeLessThan(3000);
      expect(body).toContain("&amp;".repeat(10));
    }
    const short = buildFeedbackSlackBlocks({
      ...base,
      feedback: "x".repeat(SLACK_FEEDBACK_MAX),
    })[1].text.text;
    expect(short).not.toContain("(truncated)");
  });
});
