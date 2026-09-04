import { PinataSDK, type UploadResponse } from "pinata";
import { config } from "../../config";
import { logger } from "../../infra/logger";

// Fileverse-run private IPFS node (ipfs-node, Pinata-compatible adapter). It
// speaks Pinata's Files-API wire format, so the same SDK drives it; only the
// hosts and the credential differ. File ids on the node equal the CID.
export const NODE_PRIVATE_STORAGE_TYPE = "node-private";

const nodeUrl = ((config.IPFS_NODE_URL as string) ?? "").replace(/\/+$/, "");

export const isNodeConfigured = () =>
  Boolean(nodeUrl && config.IPFS_NODE_BEARER);

// Built on first use so deployments without the node env vars still boot.
let nodeClient: PinataSDK | null = null;
const getNodeClient = () => {
  if (!isNodeConfigured()) {
    throw new Error(
      "IPFS node not configured: set IPFS_NODE_URL and IPFS_NODE_BEARER"
    );
  }
  if (!nodeClient) {
    nodeClient = new PinataSDK({
      pinataJwt: config.IPFS_NODE_BEARER as string,
      // The SDK builds the sign request as `${pinataGateway}/files/<cid>`;
      // the adapter reads the CID from that path, so the origin is enough.
      pinataGateway: nodeUrl,
      endpointUrl: `${nodeUrl}/v3`,
      uploadUrl: `${nodeUrl}/v3`,
    });
  }
  return nodeClient;
};

const formatNodePrivateUploadResponse = (file: UploadResponse) => {
  return {
    ipfsUrl: `/private/gateway?cid=${file.cid}`,
    ipfsHash: file.cid,
    // Equals the CID on the node; persisted anyway so the unpin crons delete
    // every private row by id regardless of provider.
    pinataId: file.id,
    storageType: NODE_PRIVATE_STORAGE_TYPE,
    ipfsStorage: "node",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

export const uploadPrivateToNode = async (file: {
  name: string;
  mimetype: string;
  data: Buffer;
}) => {
  try {
    const nodeFile = new File([new Uint8Array(file.data)], file.name, {
      type: file.mimetype,
    });
    const uploadedFile = await getNodeClient()
      .upload.private.file(nodeFile)
      .name(file.name);
    return formatNodePrivateUploadResponse(uploadedFile);
  } catch (err) {
    logger.error(`error while uploading private file to ipfs node: ${err}`);
    throw err;
  }
};

type PrivateRead = Awaited<
  ReturnType<PinataSDK["gateways"]["private"]["get"]>
>;

const notFound: PrivateRead = { data: null, contentType: null };

// Same two-step read the SDK performs (sign, then fetch the link), done
// explicitly so "the tenant no longer owns this CID" comes back as data: null
// (the gateway answers 404) instead of the SDK's failed fetch of an undefined
// URL. Transport failures still throw.
export const getPrivateFileFromNode = async (
  cid: string
): Promise<PrivateRead> => {
  if (!isNodeConfigured()) {
    throw new Error(
      "IPFS node not configured: set IPFS_NODE_URL and IPFS_NODE_BEARER"
    );
  }
  const signed = await fetch(`${nodeUrl}/v3/files/sign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.IPFS_NODE_BEARER}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: `${nodeUrl}/files/${cid}`,
      date: Math.floor(Date.now() / 1000),
      expires: 30,
      method: "GET",
    }),
  });
  if (signed.status === 404) {
    return notFound;
  }
  if (!signed.ok) {
    const body = await signed.text().catch(() => "");
    throw new Error(
      `ipfs node sign ${cid} failed: ${signed.status} ${body.slice(0, 200)}`
    );
  }
  const link = ((await signed.json()) as { data?: string }).data;
  if (!link) {
    throw new Error(`ipfs node sign ${cid} returned no link`);
  }

  const res = await fetch(link);
  if (res.status === 404) {
    return notFound;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `ipfs node read ${cid} failed: ${res.status} ${body.slice(0, 200)}`
    );
  }
  const contentType = res.headers.get("content-type")?.split(";")[0] || null;
  if (contentType?.includes("application/json")) {
    return { data: await res.json(), contentType };
  }
  if (contentType?.includes("text/")) {
    return { data: await res.text(), contentType };
  }
  return { data: await res.blob(), contentType };
};

// Soft delete on the node (30-day restore window, then the cold copy expires).
// Same raw-fetch shape as the Pinata delete: 404 means already gone.
export const unpinPrivateFromNode = async (pinataId: string) => {
  const res = await fetch(`${nodeUrl}/v3/files/private/${pinataId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.IPFS_NODE_BEARER}` },
  });

  if (res.ok || res.status === 404) {
    return;
  }

  const body = await res.text().catch(() => "");
  throw new Error(
    `ipfs node delete private/${pinataId} failed: ${res.status} ${body.slice(0, 200)}`
  );
};
