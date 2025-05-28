import { Schema, model } from "mongoose";
import { config } from "../../../config";
import { SourceApp, FileIPFSType } from "../../../types";

const fileSchema = new Schema({
  invokerAddress: { type: String, index: true },
  contractAddress: {
    type: String,
    lowercase: true,
    required: true,
    index: true,
  },
  gatewayUrl: {
    type: String,
    required: true,
  },
  appFileId: { type: String, index: true },
  networkName: { type: String, default: config.NETWORK_NAME },
  ipfsHash: { type: String },
  fileSize: { type: Number },
  isDeleted: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  tags: {
    type: [String],
    index: true,
    default: [],
  },
  ipfsType: {
    type: String,
    enum: FileIPFSType,
  },
  sourceApp: {
    type: String,
    enum: SourceApp,
  },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

fileSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

const File = model("files", fileSchema);

export default File;
