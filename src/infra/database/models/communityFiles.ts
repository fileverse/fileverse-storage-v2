import { Schema, model } from "mongoose";

enum Category {
  Finance = "Finance",
  AiAndLLM = "Ai and LLM's",
  Development = "Development",
}

const communityFilesSchema = new Schema({
  publishedBy: {
    type: String,
    required: true,
    index: true,
  },
  thumbnailIPFSHash: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    enum: Category,
    required: true,
  },
  favoritedBy: {
    type: [String],
    default: [],
    index: true,
  },
  fileLink: {
    type: String,
    required: true,
  },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

const CommunityFiles = model("communityFiles", communityFilesSchema);

export default CommunityFiles;
