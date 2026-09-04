import { File } from "../../infra/database/models";
import { PRIVATE_STORAGE_TYPES } from "../ipfs";

export const findAll = async (invokerAddress: string) => {
  return await File.find({ invokerAddress });
};

export const findOne = async (ipfsHash: string) => {
  return await File.findOne({ ipfsHash });
};

export const findPrivate = async (ipfsHash: string) => {
  return await File.findOne({
    ipfsHash,
    storageType: { $in: PRIVATE_STORAGE_TYPES },
  });
};
