import { Schema, model } from "mongoose";

export interface IDocUsage {
  contractAddress: string;
  appFileId: string;
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
  cutoff: number;
  updatedAt: number;
  dirty: boolean;
  dirtyAt: number | null;
  summed: boolean;
  attempts: number;
  lastError: string | null;
}

const docUsageSchema = new Schema<IDocUsage>({
  contractAddress: {
    type: String,
    lowercase: true,
    required: true,
  },
  appFileId: { type: String, required: true },
  latestFileSize: { type: Number, required: true },
  countedVersions: { type: Number, required: true },
  latestTimeStamp: { type: Number, required: true },
  charge: { type: Number, required: true },
  cutoff: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  dirty: { type: Boolean, default: false },
  dirtyAt: { type: Number, default: null },
  summed: { type: Boolean, default: true },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
});

docUsageSchema.index({ contractAddress: 1, appFileId: 1 }, { unique: true });
docUsageSchema.index(
  { dirty: 1, dirtyAt: 1 },
  { partialFilterExpression: { dirty: true } }
);
docUsageSchema.index(
  { summed: 1, contractAddress: 1 },
  { partialFilterExpression: { summed: false } }
);

const DocUsage = model<IDocUsage>("doc-usages", docUsageSchema);

export default DocUsage;
