import { Request } from "express";

export interface CustomRequest extends Request {
  requestId?: string;
  isAuthenticated?: boolean;
  invokerAddress?: string | null;
  contractAddress?: string | null;
  chainId?: string | null;
  address?: string;
  contractAddresses?: string[] | null;
}

export enum FileIPFSType {
  GATE = "GATE",
  CONTENT = "CONTENT",
  METADATA = "METADATA",
  COMMENT = "COMMENT",
}

export enum SourceApp {
  DDOC = "ddoc",
  DSHEET = "dsheet",
}

export interface IFile {
  invokerAddress: string;
  contractAddress: string;
  gatewayUrl: string;
  appFileId: string;
  ipfsHash: string;
  networkName: string;
  fileSize: number;
  tags: string[];
  timeStamp: number;
  isDeleted: boolean;
  ipfsType: FileIPFSType;
  isPinned: boolean;
  sourceApp: SourceApp;
}

export interface ICreateCommunityFilesParams {
  publishedBy: string;
  thumbnailIPFSHash: string;
  title: string;
  category: string;
  fileLink: string;
  dsheetId: string;
  userHash: string;
  portalAddress: string;
}
