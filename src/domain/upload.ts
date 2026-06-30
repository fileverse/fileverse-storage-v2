import { create } from "./file";
import { uploadPublic as uploadPublicToPinata, uploadPrivate as uploadPrivateToPinata} from "./ipfs";
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

  const ipfsFile = await uploadPublicToPinata({
    name, 
    mimetype, 
    data
  });

  await create({
    appFileId,
    ipfsHash: ipfsFile?.ipfsHash,
    gatewayUrl: ipfsFile?.ipfsUrl,
    storageType: ipfsFile?.storageType,
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
    storageType: ipfsFile?.storageType,
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

  const ipfsFile = await uploadPublicToPinata({
    name, 
    mimetype, 
    data
  });

  return {
    ipfsUrl: ipfsFile?.ipfsUrl,
    ipfsHash: ipfsFile?.ipfsHash,
    storageType: ipfsFile?.storageType,
    fileSize: ipfsFile?.pinSize,
    mimetype,
    ipfsType,
  };
};

export const uploadOnlyPrivate = async (params: IUploadParams) => {
  const { file, ipfsType } = params;
  const { name, mimetype, data } = file;

  const ipfsFile = await uploadPrivateToPinata({
    name, 
    mimetype, 
    data
  });

  return {
    ipfsUrl: ipfsFile?.ipfsUrl,
    ipfsHash: ipfsFile?.ipfsHash,
    storageType: ipfsFile?.storageType,
    fileSize: ipfsFile?.pinSize,
    mimetype,
    ipfsType,
  };
};
