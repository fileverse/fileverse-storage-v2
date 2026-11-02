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
  // Only on SUGGESTION rows, which carry no contractAddress so no quota counts them.
  suggestion: {
    type: new Schema(
      {
        claimed: { type: Boolean, required: true },
        portal: { type: String },
        linkId: { type: String },
        claimedAt: { type: Date },
      },
      { _id: false }
    ),
    default: undefined,
  },
});

fileSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

// Indexes on this collection are created by hand; a build started by every
// booting dyno is too heavy for its size.
fileSchema.set("autoIndex", false);

fileSchema.index({
  contractAddress: 1,
  appFileId: 1,
  ipfsType: 1,
  isDeleted: 1,
  timeStamp: -1,
  _id: -1,
});

// One live suggestion row per CID, even for uploads that land at once: unpinning any row deletes the shared pin.
fileSchema.index(
  { ipfsHash: 1, ipfsType: 1 },
  { unique: true, partialFilterExpression: { ipfsType: FileIPFSType.SUGGESTION, isDeleted: false } }
);

const File = model("files", fileSchema);

export default File;
