import { reportValidation } from "./schema";

const valid = {
  topic: "Bug",
  feedback: "  it broke  ",
  contactPreference: "",
  wantContact: false,
  isLLMRequest: false,
  source: "owner-help-menu",
  app: "ddocs",
  ddocId: "mK4nKR1X3PE5gbd7r9VqZp",
  portalAddress: "0x1A592FAf20Dd976fcbb5Fc829d504F2bfbE87E3B",
};

const check = (body: Record<string, unknown>) =>
  reportValidation.body.validate(body, { abortEarly: false });

describe("reportValidation.body", () => {
  it("accepts a full bug report and trims feedback", () => {
    const { error, value } = check(valid);
    expect(error).toBeUndefined();
    expect(value.feedback).toBe("it broke");
  });

  it("accepts an empty topic and a minimal general report", () => {
    const { error } = check({
      topic: "",
      feedback: "hi",
      wantContact: false,
      isLLMRequest: false,
      source: "home-help-menu",
      app: "ddocs",
    });
    expect(error).toBeUndefined();
  });

  it("rejects unknown fields", () => {
    expect(check({ ...valid, url: "https://x" }).error).toBeDefined();
  });

  it("rejects an unknown source and an unknown topic", () => {
    expect(check({ ...valid, source: "nope" }).error).toBeDefined();
    expect(check({ ...valid, topic: "Rant" }).error).toBeDefined();
  });

  it("rejects over-length feedback and contact", () => {
    expect(check({ ...valid, feedback: "x".repeat(5001) }).error).toBeDefined();
    expect(check({ ...valid, contactPreference: "x".repeat(301) }).error).toBeDefined();
  });

  it("rejects a malformed portal address and id", () => {
    expect(check({ ...valid, portalAddress: "0x123" }).error).toBeDefined();
    expect(check({ ...valid, ddocId: "has space" }).error).toBeDefined();
  });

  it("rejects ddocId and dsheetId together", () => {
    expect(check({ ...valid, dsheetId: "sheet1" }).error).toBeDefined();
  });

  it("rejects missing feedback and blank feedback", () => {
    const { feedback, ...noFeedback } = valid;
    expect(check(noFeedback).error).toBeDefined();
    expect(check({ ...valid, feedback: "   " }).error).toBeDefined();
  });

  it("rejects string booleans", () => {
    expect(check({ ...valid, wantContact: "TRUE" }).error).toBeDefined();
    expect(check({ ...valid, isLLMRequest: "false" }).error).toBeDefined();
  });
});
