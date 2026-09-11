import { Joi } from "express-validation";

export const FEEDBACK_SOURCES = [
  "owner-help-menu",
  "home-help-menu",
  "viewer-help-menu",
  "viewer-error-screen",
  "publish-failure-toast",
  "folder-help-menu",
  "dsheet-help-menu",
  "llm-request",
] as const;

export const FEEDBACK_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PORTAL_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export interface FeedbackRequestBody {
  topic: string;
  feedback: string;
  contactPreference: string;
  wantContact: boolean;
  isLLMRequest: boolean;
  source: (typeof FEEDBACK_SOURCES)[number];
  app: "ddocs" | "dsheets";
  ddocId?: string;
  dsheetId?: string;
  portalAddress?: string;
}

export const reportValidation = {
  body: Joi.object({
    topic: Joi.string().valid("Bug", "Feature", "General", "LLM", "").required(),
    feedback: Joi.string().trim().min(1).max(5000).required(),
    contactPreference: Joi.string().allow("").max(300).default(""),
    wantContact: Joi.boolean().strict().required(),
    isLLMRequest: Joi.boolean().strict().required(),
    source: Joi.string()
      .valid(...FEEDBACK_SOURCES)
      .required(),
    app: Joi.string().valid("ddocs", "dsheets").required(),
    ddocId: Joi.string().pattern(FEEDBACK_ID_PATTERN),
    dsheetId: Joi.string().pattern(FEEDBACK_ID_PATTERN),
    portalAddress: Joi.string().pattern(PORTAL_ADDRESS_PATTERN),
  })
    .oxor("ddocId", "dsheetId")
    .unknown(false),
};
