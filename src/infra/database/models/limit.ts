import { Schema, model } from "mongoose";
import { config } from "../../../config";

const limitSchema = new Schema({
  contractAddress: {
    type: String,
    lowercase: true,
    required: false,
    index: true,
  },
  invokerAddress: {
    type: String,
    lowercase: true,
    required: false,
    index: true,
    default: null,
  },
  storageLimit: {
    type: Schema.Types.Decimal128,
    default: config.DEFAULT_STORAGE_LIMIT || 2000000000,
  },
  storageUse: {
    type: Schema.Types.Decimal128,
    default: 0,
  },
  extraStorage: {
    type: Schema.Types.Decimal128,
    default: 0,
  },
  extendableStorage: {
    type: Schema.Types.Decimal128,
    default: 1000000000, // 1GB
  },
  unit: { type: String, default: "bytes" },
  claimsMap: { type: Schema.Types.Mixed },
  redeemMap: { type: Schema.Types.Mixed },
  redeemMapDetails: { type: Schema.Types.Mixed },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

limitSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

limitSchema.methods.safeObject = function () {
  const safeFields = [
    "_id",
    "contractAddress",
    "storageLimit",
    "timeStamp",
    "extraStorage",
  ];
  const newSafeObject = {};
  safeFields.forEach((elem) => {
    (newSafeObject as Record<string, unknown>)[elem] = this[elem];
  });
  return newSafeObject;
};

const Limit = model("limits", limitSchema);

export default Limit;
