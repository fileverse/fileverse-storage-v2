import { Schema, model } from "mongoose";

const imageSchema = new Schema({
  hash: {
    type: String,
    required: true,
    index: true,
  },
  origin: {
    type: String,
    required: true,
  },
  gateway: {
    type: String,
    required: true,
  },
  apiKey: {
    type: String,
    required: true,
  },
});

const Image = model("images", imageSchema);

export default Image;