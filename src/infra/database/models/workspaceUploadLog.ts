import { Schema, model } from "mongoose";
import { FileIPFSType } from "../../../types";

const workspaceUploadLogSchema = new Schema({
  contractAddress: {
    type: String,
    lowercase: true,
    required: true,
    index: true,
  },
  ipfsHash: {
    type: String,
    required: true,
    index: true,
  },
  fileSize: {
    type: Schema.Types.Decimal128,
    required: true,
  },
  invokerAddress: {
    type: String,
    lowercase: true,
    required: true,
  },
  ipfsType: {
    type: String,
    enum: FileIPFSType,
    required: true,
  },
  uploadedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

workspaceUploadLogSchema.index({ contractAddress: 1, uploadedAt: -1 });

const WorkspaceUploadLog = model(
  "workspaceUploadLogs",
  workspaceUploadLogSchema
);

export default WorkspaceUploadLog;
