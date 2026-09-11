import { Schema, model } from "mongoose";

const feedbackSchema = new Schema(
  {
    topic: { type: String, required: true },
    feedback: { type: String, required: true },
    contactPreference: { type: String },
    wantContact: { type: Boolean, required: true },
    isLLMRequest: { type: Boolean, required: true },
    source: { type: String, required: true, index: true },
    app: { type: String, required: true },
    ddocId: { type: String, index: true },
    dsheetId: { type: String, index: true },
    portalAddress: { type: String, index: true },
    slackDelivered: { type: Boolean, required: true },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

const Feedback = model("feedbacks", feedbackSchema);

export default Feedback;
