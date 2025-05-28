import { File } from "../../infra/database/models";

export const findAll = async (invokerAddress: string) => {
  return await File.find({ invokerAddress });
};

export const findOne = async (ipfsHash: string) => {
  return await File.findOne({ ipfsHash });
};
