import { Readable } from "stream";
import { config } from "../../config";
import pinataSDK, { type PinataPinOptions } from "@pinata/sdk";
import { PinataSDK, type UploadResponse } from "pinata";
import { logger } from "../../infra/logger";


// Legacy SDK client: kept only for unpin-by-CID of public rows created before
// the Files API migration (no pinataId stored). New uploads never use it.
const pinataClient = pinataSDK(
  config.PINATA_API_KEY as string,
  config.PINATA_SECRET_KEY as string
);

// Private files are served by the same dedicated-gateway domain as public
// reads. PINATA_GATEWAY carries the public /ipfs path suffix; the SDK appends
// /files/<cid> itself, so it must get the origin only.
const privateGatewayDomain = ((config.PINATA_GATEWAY as string) ?? "")
  .replace(/\/+$/, "")
  .replace(/\/ipfs$/, "");

// Files API client (JWT auth): private lane, and public uploads since the
// legacy-SDK migration. Must stay on the same Pinata account as pinataClient.
const pinataFilesClient = new PinataSDK({
  pinataJwt: config.PINATA_JWT_KEY as string,
  pinataGateway: privateGatewayDomain,
});

// Public images pin to the dedicated image Pinata account — the same
// credentials and gateway the fileverse-images service used, separate from
// the storage account above.
const pinataImageClient = pinataSDK(
  config.PINATA_IMAGE_API_KEY as string,
  config.PINATA_IMAGE_SECRET_KEY as string
);

const imageGateway = ((config.PINATA_IMAGE_GATEWAY as string) ?? "").replace(
  /\/+$/,
  ""
);

const formatUploadResponse = (file: UploadResponse) => {
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.cid}`,
    ipfsHash: file.cid,
    // Pinata file id: the only handle files.public.delete() accepts; must be
    // persisted or the pin is undeletable (legacy rows without it fall back
    // to unpin-by-CID in the crons).
    pinataId: file.id,
    storageType: "pinata-public",
    ipfsStorage: "pinata",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

const formatPrivateUploadResponse = (file: UploadResponse)=>{// formatter for private upload newer sdk
  return {
    // Relative proxy path — persisted as File.gatewayUrl (write-only
    // bookkeeping, required by the schema); never returned to clients.
    ipfsUrl: `/private/gateway?cid=${file.cid}`,
    ipfsHash: file.cid,
    // Pinata file id — the only handle files.private.delete() accepts;
    // must be persisted or the pin is undeletable.
    pinataId: file.id,
    storageType: "pinata-private",
    ipfsStorage: "pinata",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

// Public upload via the Files API. Returns CIDv1 (bafy...) hashes; legacy
// rows and onchain records keep their Qm strings, so both formats coexist.
// Clients and gateways treat CIDs as opaque, format-agnostic strings.
export const upload = async (file: {
  name: string;
  mimetype: string;
  data: Buffer;
}) => {
  try {
    const pinataFile = new File([new Uint8Array(file.data)], file.name, {
      type: file.mimetype,
    });
    const uploadedFile = await pinataFilesClient.upload.public
      .file(pinataFile)
      .name(file.name);

    return formatUploadResponse(uploadedFile);
  } catch (err) {
    console.error("error while uploading to pinata", err);
    logger.error(`error while uploading to pinata: ${err}`);
    throw err;
  }
};


// Public image upload — image account, legacy sdk (same call shape the
// fileverse-images service used; filename is already hashed by the route).
export const uploadPublicImage = async (file: {
  name: string;
  data: Buffer;
}) => {
  const stream = Readable.from(file.data, { objectMode: false });
  Object.assign(stream, { path: file.name });

  const options: PinataPinOptions = {
    pinataMetadata: {
      name: file.name,
    },
    pinataOptions: {
      cidVersion: 0,
    },
  };

  try {
    const uploaded = await pinataImageClient.pinFileToIPFS(stream, options);
    return {
      ipfsUrl: `${imageGateway}/${uploaded.IpfsHash}`,
      ipfsHash: uploaded.IpfsHash,
      gateway: imageGateway,
      pinSize: uploaded.PinSize,
    };
  } catch (err) {
    console.error("error while uploading public image", err);
    logger.error(`error while uploading public image: ${err}`);
    throw err;
  }
};

// Legacy unpin-by-CID: only for public rows with no pinataId (uploaded via the
// old pinning API). Rows created by the Files API are deleted by id below.
export const unpin = async (ipfsHash: string) => {
  try {
    await pinataClient.unpin(ipfsHash);
  } catch (err) {
    console.error("error while unpinning from pinata", err);
    throw err;
  }
};

// The SDK's files.*.delete() resolves even when a delete fails: it catches each
// per-id error and returns it as a `status` string, collapsing 404 and 5xx into
// the same message. The unpin crons must be able to both detect failure (or they
// mark a live pin as unpinned forever) and recognise an already-gone file (or
// they retry it forever), so the delete goes out directly.
const deletePinataFile = async (
  lane: "public" | "private",
  pinataId: string
) => {
  const res = await fetch(
    `https://api.pinata.cloud/v3/files/${lane}/${pinataId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.PINATA_JWT_KEY}` },
    }
  );

  // 404: already deleted, which is the state the caller wanted. Mirrors the
  // legacy path's CURRENT_USER_HAS_NOT_PINNED_CID handling.
  if (res.ok || res.status === 404) {
    return;
  }

  const body = await res.text().catch(() => "");
  throw new Error(
    `pinata delete ${lane}/${pinataId} failed: ${res.status} ${body.slice(0, 200)}`
  );
};

export const unpinPublic = async (pinataId: string) => {
  try {
    await deletePinataFile("public", pinataId);
  } catch (err) {
    console.error("error while deleting public file from pinata", err);
    throw err;
  }
};

// newer sdk private upload
export const uploadPrivate = async (
  file: {
    name:string;
    mimetype: string;
    data: Buffer;
    }
)=>{
  try{
    const pinataFile=new File(
      [new Uint8Array(file.data)],
      file.name,
      {
        type: file.mimetype,
      }
    );
    const uploadedFile = await pinataFilesClient.upload.private.file(pinataFile).name(file.name);
    return formatPrivateUploadResponse(uploadedFile);
  }
  catch(err){
    console.error("error while uploading private file", err);
    logger.error(`error while uploading private file: ${err}`);
    throw err;
  }
}

export const getPrivateFile = async (cid: string) => {
    return pinataFilesClient.gateways.private.get(cid);
};

export const unpinPrivate = async (pinataId: string) => {
  try {
    await deletePinataFile("private", pinataId);
  } catch (err) {
    console.error("error while deleting private file from pinata", err);
    throw err;
  }
};