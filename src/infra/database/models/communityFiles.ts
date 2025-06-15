import { Schema, model } from "mongoose";

enum Category {
  DeFi = "DeFi",
  Accounting = "Accounting",
  CreativeDSheet = "Creative dSheets",
  PortfolioManagement = "Portfolio Management",
  EventsAndConferences = "Events and conferences",
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
    enum: Object.values(Category),
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
  dsheetId: {
    type: String,
    required: true,
  },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
  userHash: {
    type: String,
    required: true,
  },
  portalAddress: {
    type: String,
    required: true,
  },
});

const CommunityFiles = model("communityFiles", communityFilesSchema);

export default CommunityFiles;
