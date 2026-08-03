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
  // Pinata file id for private-lane images — the only handle
  // files.private.delete() accepts. Absent on public images.
  pinataId: {
    type: String,
  },
});

const Image = model("images", imageSchema);

export default Image;