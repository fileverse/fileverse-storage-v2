import { Schema, model } from "mongoose";

interface IUserOps {
  _id: string;
  userOpHash: string;
  isProcessed: boolean;
  timeStamp: number;
  nullifier: string;
  floppyShortCode: string;
  contractAddress: string;
}

const UserOpsSchema = new Schema({
  userOpHash: { type: String, index: true, required: true },
  isProcessed: { type: Boolean, default: false, required: true },
  timeStamp: { type: Number, required: true, default: Date.now },
  floppyShortCode: { type: String, index: true },
  contractAddress: { type: String, index: true, required: true },
  nullifier: { type: String, required: true },
});

UserOpsSchema.pre("save", function (next) {
  this.timeStamp = Date.now();
  next();
});

const UserOps = model<IUserOps>("userOps", UserOpsSchema);

export default UserOps;
