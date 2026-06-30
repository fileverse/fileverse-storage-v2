import { FileIPFSType } from "../../types";

export interface BatchUploadResponse {
  gateIpfsHash: string;
  contentIpfsHash: string;
  metadataIpfsHash: string;
}

export const getIPFSTypeFromFileName = (fileName: string) => {
  if (fileName.includes("METADATA")) return FileIPFSType.METADATA;
  if (fileName.includes("CONTENT")) return FileIPFSType.CONTENT;
  if (fileName.includes("GATE")) return FileIPFSType.GATE;
  throw new Error("Invalid file name");
};