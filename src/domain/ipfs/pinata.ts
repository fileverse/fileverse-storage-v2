import { PassThrough,Readable } from "stream";
import request from "request";
import { config } from "../../config";
import pinataSDK, {
  type PinataPinOptions,
  type PinataPinResponse,
} from "@pinata/sdk";
import { PinataSDK, type UploadResponse } from "pinata";
import { logger } from "../../infra/logger";


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

const pinataPrivateClient = new PinataSDK({
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

const formatUploadResponse  = (file: PinataPinResponse) => { //formatter for older sdk cuz properties not same
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.IpfsHash}`,
    ipfsHash: file.IpfsHash,
    storageType: "pinata-public",
    ipfsStorage: "pinata",
    pinSize: file.PinSize,
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

interface UploadToPinataOptions {
  name: string;
  attributes?: { trait_type: string; value: string }[];
}

// older sdk upload function (public upload)
export const upload = async ( 
  readableStreamForFile: Readable,
  { name, attributes }: UploadToPinataOptions
) => {
  const keyvalues: Record<string, string> = {};

  (attributes || []).forEach((attribute) => {
    keyvalues[attribute.trait_type] = attribute.value;
  });

  const options: PinataPinOptions = {
    pinataMetadata: {
      name,
      ...keyvalues,
    },
    pinataOptions: {
      cidVersion: 0,
    },
  };

  try {
    const file = await pinataClient.pinFileToIPFS(
      readableStreamForFile,
      options
    );

    return formatUploadResponse (file);
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

export const get = async (ipfsUrl: string) => {
  if (!ipfsUrl) {
    return null;
  }
  const ipfsStream = new PassThrough();
  request(ipfsUrl).pipe(ipfsStream);
  return ipfsStream;
};

export const unpin = async (ipfsHash: string) => {
  try {
    await pinataClient.unpin(ipfsHash);
  } catch (err) {
    console.error("error while unpinning from pinata", err);
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
    const uploadedFile = await pinataPrivateClient.upload.private.file(pinataFile).name(file.name);
    return formatPrivateUploadResponse(uploadedFile);
  }
  catch(err){
    console.error("error while uploading private file", err);
    logger.error(`error while uploading private file: ${err}`);
    throw err;
  }
}

export const getPrivateFile = async (cid: string) => {
    return pinataPrivateClient.gateways.private.get(cid);
};

export const unpinPrivate = async (pinataId: string) => {
  try {
    await pinataPrivateClient.files.private.delete([pinataId]);
  } catch (err) {
    console.error("error while deleting private file from pinata", err);
    throw err;
  }
};