import { Readable } from "stream";
import { create } from "./file";
import { upload as uploadToPinata } from "./ipfs";
import { FileIPFSType, SourceApp } from "../types";

interface IUploadParams {
  appFileId: string;
  sourceApp: SourceApp;
  contractAddress: string;
  file: { name: string; mimetype: string; data: Buffer };
  invokerAddress: string;
  tags: string[];
  ipfsType: FileIPFSType;
}

export const upload = async (params: IUploadParams) => {
  const {
    appFileId,
    sourceApp,
    contractAddress,
    file,
    invokerAddress,
    tags,
    ipfsType,
  } = params;
  const { name, mimetype, data } = file;

  const stream = Readable.from(data, { objectMode: false });
  Object.assign(stream, { path: name });

  const ipfsFile = await uploadToPinata(stream, { name });

  await create({
    appFileId,
    ipfsHash: ipfsFile?.ipfsHash,
    gatewayUrl: ipfsFile?.ipfsUrl,
    contractAddress,
    invokerAddress,
    fileSize: ipfsFile?.pinSize,
    tags: tags || [],
    sourceApp,
    ipfsType,
  });

  return {
    ipfsUrl: ipfsFile?.ipfsUrl,
    ipfsHash: ipfsFile?.ipfsHash,
    ipfsStorage: ipfsFile?.ipfsStorage,
    fileSize: ipfsFile?.pinSize,
    mimetype,
    appFileId,
    contractAddress,
    ipfsType,
  };
};

export const uploadOnly = async (params: IUploadParams) => {
  const { file, ipfsType } = params;
  const { name, mimetype, data } = file;

  const stream = Readable.from(data, { objectMode: false });
  Object.assign(stream, { path: name });

  const ipfsFile = await uploadToPinata(stream, { name });

  return {
    ipfsUrl: ipfsFile?.ipfsUrl,
    ipfsHash: ipfsFile?.ipfsHash,
    ipfsStorage: ipfsFile?.ipfsStorage,
    fileSize: ipfsFile?.pinSize,
    mimetype,
    ipfsType,
  };
};
