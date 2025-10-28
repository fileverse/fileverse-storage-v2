import { Schema, model } from "mongoose";
import { config } from "../../../config";
import { DBFloppy } from "../../../types";

const FloppySchema = new Schema({
  shortCode: { type: String, index: true, required: true },
  sgid: { type: String, index: true, default: "n/a" },
  name: { type: String, index: true, required: true },
  description: { type: String, index: true, required: true },
  img: { type: String, index: true, required: true },
  metadataURI: { type: String, index: true, required: true },
  diskSpace: { type: Number, index: true, required: true },
  members: { type: [String], index: true, default: [] },
  nullifiers: { type: [String], index: true, default: [] },
  offchain: { type: Boolean, default: false },
  networkName: {
    type: String,
    enum: [config.NETWORK_NAME, "offchain"],
    default: "offchain",
  },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
  onChainFloppyId: { type: Number, index: true, required: false },
});

FloppySchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

const Floppy = model<DBFloppy>("floppys", FloppySchema);

export default Floppy;
