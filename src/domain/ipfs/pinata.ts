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

const pinataPrivateClient = new PinataSDK({
  pinataJwt: config.PINATA_JWT_KEY as string,
  pinataGateway: config.PINATA_GATEWAY as string,
});

const formatUploadResponse  = (file: PinataPinResponse) => { //formatter for older sdk cuz properties not same
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.IpfsHash}`,
    ipfsHash: file.IpfsHash,
    storageType: "pinata-public",
    pinSize: file.PinSize,
    timestamp: new Date().toISOString(),
  };
};

const formatPublicUploadResponse = (file: UploadResponse) => { //formatter for public upload newer sdk
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.cid}`,
    ipfsHash: file.cid,
    storageType: "pinata-public",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

const formatPrivateUploadResponse = (file: UploadResponse)=>{// formatter for private upload newer sdk
  return {
    ipfsUrl: ``,
    ipfsHash: file.cid,
    storageType: "pinata-private",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

interface UploadToPinataOptions {
  name: string;
  attributes?: { trait_type: string; value: string }[];
}

// older sdk upload function (kept as the interface/upload/publicUpload.ts doesnt throw error)
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


export const uploadPublic = async (
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
    const uploadedFile = await pinataPrivateClient.upload.public.file(pinataFile).name(file.name);
    return formatPublicUploadResponse(uploadedFile);
  }
  catch(err){
    console.error("error while uploading public file", err);
    logger.error(`error while uploading public file: ${err}`);
    throw err;
  }
}

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

export const createPrivateAccessLink = async (
  cid:string,
  expiresInSeconds=Number(config.ACCESS_LINK_EXPIRES_IN_SECOND)
) => {
  try {
    return await pinataPrivateClient.gateways.private.createAccessLink({
      cid,
      expires: expiresInSeconds,
    });
  } catch (err) {
    console.error("error while creating private access link", err);
    logger.error(`error while creating private access link: ${err}`);
    throw err;
  }
};