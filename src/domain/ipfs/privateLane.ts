import { getPrivateFile, unpinPrivate, uploadPrivate } from "./pinata";
import {
  NODE_PRIVATE_STORAGE_TYPE,
  getPrivateFileFromNode,
  unpinPrivateFromNode,
  uploadPrivateToNode,
} from "./node";

// Private-lane provider routing. The caller names the provider per upload
// (temporary `storageProvider=node` query param on the private routes while
// the Fileverse ipfs-node is on trial; absent = Pinata, unchanged). Reads and
// deletes follow the File row's storageType, so every row keeps resolving on
// the provider that holds it.
export const PINATA_PRIVATE_STORAGE_TYPE = "pinata-private";

export const PRIVATE_STORAGE_TYPES = [
  PINATA_PRIVATE_STORAGE_TYPE,
  NODE_PRIVATE_STORAGE_TYPE,
];

export const isPrivateStorageType = (storageType?: string | null) =>
  PRIVATE_STORAGE_TYPES.includes(storageType ?? "");

export type PrivateStorageProvider = "pinata" | "node";

export const parsePrivateStorageProvider = (
  raw: unknown
): PrivateStorageProvider => (raw === "node" ? "node" : "pinata");

export const uploadPrivateFile = async (
  file: { name: string; mimetype: string; data: Buffer },
  provider: PrivateStorageProvider = "pinata"
) => {
  return provider === "node" ? uploadPrivateToNode(file) : uploadPrivate(file);
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
