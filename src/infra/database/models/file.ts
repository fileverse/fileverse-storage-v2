import { Schema, model } from "mongoose";
import { config } from "../../../config";
import { SourceApp, FileIPFSType } from "../../../types";

const fileSchema = new Schema({
  invokerAddress: { type: String, index: true },
  contractAddress: {
    type: String,
    lowercase: true,
    required: false,
    index: true,
  },
  gatewayUrl: {
    type: String,
    required: true
  },
  appFileId: { type: String, index: false },
  networkName: { type: String, default: config.NETWORK_NAME },
  ipfsHash: { type: String, index: true },
  storageType: { type: String },
  // Pinata file id for Files-API uploads (private lane, and public since the
  // legacy-SDK migration) — required to delete the pin. Absent on public rows
  // predating that migration, which the unpin crons fall back to unpinning by
  // CID; do not backfill it without confirming delete-by-id works on old pins.
  pinataId: { type: String },
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
  markedForUnpin: {
    type: Boolean,
    default: false,
  },
});

fileSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

const File = model("files", fileSchema);

export default File;
