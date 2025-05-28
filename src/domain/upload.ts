import { Readable } from "stream";
import { create } from "./file";
import { upload as uploadToPinata } from "./ipfs";
import { FileIPFSType, SourceApp } from "../types";
// import { Cache } from "./cache";

// const cache = new Cache();

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
  // Extract file metadata
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

  // Create a readable stream from file data
  const stream = Readable.from(data);

  // Set path property using Object.assign since path is not a standard Readable property
  Object.assign(stream, { path: name });

  // Calculate file size
  const filesize = data.length;

  console.log(
    "Uploading file:",
    mimetype,
    ", size:",
    filesize,
    ", bytes from contract:",
    contractAddress,
    ", invoker:",
    invokerAddress
  );

  const ipfsFile = await uploadToPinata(stream, { name });

  // const cachedFile = await cache.queue(ipfsFile);

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

  // Return uploaded file metadata
  return {
    ipfsUrl: ipfsFile?.ipfsUrl,
    ipfsHash: ipfsFile?.ipfsHash,
    ipfsStorage: ipfsFile?.ipfsStorage,
    // cachedUrl: cachedFile?.cachedUrl,
    fileSize: ipfsFile?.pinSize,
    mimetype,
    appFileId,
    contractAddress,
  };
};
