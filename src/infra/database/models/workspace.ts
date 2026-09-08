import { Schema, model } from "mongoose";

// Durable record of a portal's workspace status, confirmed once against the
// identity indexer. Portal type is fixed at mint, so a confirmed answer never
// goes stale.
const workspaceSchema = new Schema({
  _id: { type: String, required: true, lowercase: true }, // portal address
  isWorkspace: { type: Boolean, required: true },
  confirmedAt: { type: Date, required: true },
});

const Workspace = model("workspaces", workspaceSchema);

export default Workspace;
