import { config } from "../../config";
import { getPrivateFile, unpinPrivate, uploadPrivate } from "./pinata";
import {
  NODE_PRIVATE_STORAGE_TYPE,
  getPrivateFileFromNode,
  isNodeConfigured,
  unpinPrivateFromNode,
  uploadPrivateToNode,
} from "./node";

// Private-lane provider routing. PRIVATE_STORAGE_PROVIDER picks where NEW
// private uploads go (node = the Fileverse ipfs-node, pinata = default). Reads
// and deletes follow the File row's storageType, so every row keeps resolving
// on the provider that holds it and flipping the flag back is a clean rollback.
export const PINATA_PRIVATE_STORAGE_TYPE = "pinata-private";

export const PRIVATE_STORAGE_TYPES = [
  PINATA_PRIVATE_STORAGE_TYPE,
  NODE_PRIVATE_STORAGE_TYPE,
];

export const isPrivateStorageType = (storageType?: string | null) =>
  PRIVATE_STORAGE_TYPES.includes(storageType ?? "");

export type PrivateStorageProvider = "pinata" | "node";

// Resolved once at boot so a bad value refuses to start the process instead
// of failing the first user upload.
const resolvePrivateStorageProvider = (): PrivateStorageProvider => {
  const raw = (config.PRIVATE_STORAGE_PROVIDER ?? "pinata").trim();
  if (raw !== "pinata" && raw !== "node") {
    throw new Error(
      `PRIVATE_STORAGE_PROVIDER must be "pinata" or "node", got "${raw}"`
    );
  }
  if (raw === "node" && !isNodeConfigured()) {
    throw new Error(
      "PRIVATE_STORAGE_PROVIDER=node requires IPFS_NODE_URL and IPFS_NODE_BEARER"
    );
  }
  return raw;
};

export const privateStorageProvider: PrivateStorageProvider =
  resolvePrivateStorageProvider();

export const uploadPrivateFile = async (file: {
  name: string;
  mimetype: string;
  data: Buffer;
}) => {
  return privateStorageProvider === "node"
    ? uploadPrivateToNode(file)
    : uploadPrivate(file);
};

export const getPrivateFileByStorageType = async (
  cid: string,
  storageType?: string | null
) => {
  return storageType === NODE_PRIVATE_STORAGE_TYPE
    ? getPrivateFileFromNode(cid)
    : getPrivateFile(cid);
};

export const unpinPrivateByStorageType = async (
  pinataId: string,
  storageType?: string | null
) => {
  return storageType === NODE_PRIVATE_STORAGE_TYPE
    ? unpinPrivateFromNode(pinataId)
    : unpinPrivate(pinataId);
};
