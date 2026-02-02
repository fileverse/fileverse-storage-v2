import { Schema, model } from "mongoose";

const apiAccessKeySchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  ownerAddress: {
    type: String,
    lowercase: true,
    required: true,
    index: true,
  },
  portalAddress: {
    type: String,
    lowercase: true,
    required: true,
    index: true,
  },
  encryptedKeyMaterial: {
    type: String,
    required: true,
  },
  encryptedAppMaterial: {
    type: String,
    required: true,
  },
  timeStamp: {
    type: Number,
    required: true,
    default: Date.now,
  },
});

apiAccessKeySchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

const ApiAccessKey = model("apiAccessKeys", apiAccessKeySchema);

export default ApiAccessKey;
