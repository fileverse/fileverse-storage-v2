import { Schema, model } from "mongoose";

const legacyPortalLimitSchema = new Schema({
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
    default: 0,
  },
  storageUse: {
    type: Schema.Types.Decimal128,
    default: 0,
  },
  parentPortalAddress: {
    type: String,
    lowercase: true,
    required: true,
    index: true,
  },
  extraStorage: {
    type: Schema.Types.Decimal128,
    default: 0,
  },
  extendableStorage: {
    type: Schema.Types.Decimal128,
    default: 0, // 1GB
  },
  unit: { type: String, default: "bytes" },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

legacyPortalLimitSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

legacyPortalLimitSchema.methods.safeObject = function () {
  const safeFields = [
    "_id",
    "contractAddress",
    "storageLimit",
    "timeStamp",
    "extraStorage",
    "parentPortalAddress",
  ];
  const newSafeObject = {};
  safeFields.forEach((elem) => {
    (newSafeObject as Record<string, unknown>)[elem] = this[elem];
  });
  return newSafeObject;
};

const LegacyPortalLimit = model(
  "legacy-portal-limits",
  legacyPortalLimitSchema
);

export default LegacyPortalLimit;
