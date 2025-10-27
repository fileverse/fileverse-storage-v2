import { Request } from "express";
import type { SmartAccountClient } from "permissionless";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import type {
  Chain,
  RpcSchema,
  Client,
  Transport,
  Hex,
  EncodeDeployDataReturnType,
  Account,
} from "viem";
import {
  SmartAccount,
  WaitForUserOperationReceiptReturnType,
} from "viem/account-abstraction";
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

export type TSmartAccountClient = SmartAccountClient<
  Transport,
  Chain,
  SmartAccount,
  Client,
  RpcSchema
>;

export interface IExecuteUserOperationRequest {
  contractAddress: Hex;
  data: EncodeDeployDataReturnType;
}

export interface IAgentClient {
  pimlicoClient: ReturnType<typeof createPimlicoClient>;
  initializeAgentClient: () => Promise<void>;
  getAgentAccount: () => Account;
  getAgentAddress: () => Hex;
  getSmartAccountAgent: () => TSmartAccountClient;
  sendUserOperation: (
    request: IExecuteUserOperationRequest | IExecuteUserOperationRequest[],
    customGasLimit?: number
  ) => Promise<Hex>;
  executeUserOperationRequest: (
    request: IExecuteUserOperationRequest | IExecuteUserOperationRequest[],
    timeout: number,
    customGasLimit?: number
  ) => Promise<WaitForUserOperationReceiptReturnType>;
  getNonce: () => bigint;
}

export interface IOnChainFloppy {
  id: bigint;
  shortCode: string;
  groupId: bigint;
  maxCount: bigint;
  diskSpace: bigint;
  grantCount: bigint;
  metadataURI: string;
}
