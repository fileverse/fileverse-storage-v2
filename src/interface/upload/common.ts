import type { UploadedFile } from "express-fileupload";
import { CustomRequest, FileIPFSType } from "../../types";

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

// express-fileupload hands a lone file over as an object, not a one-item array:
// a metadata-only batch (an asset re-anchor with its gate kept) sends one part.
export const getBatchFiles = (req: CustomRequest): UploadedFile[] => {
  const files = req.files?.files;
  if (!files) return [];
  return Array.isArray(files) ? files : [files];
};