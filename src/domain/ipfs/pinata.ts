import { PassThrough } from "stream";
import request from "request";
import { config } from "../../config";
import pinataSDK, {
  type PinataPinOptions,
  type PinataPinResponse,
} from "@pinata/sdk";
import { PinataSDK } from "pinata";
import { logger } from "../../infra/logger";


const pinataClient = pinataSDK(
  config.PINATA_API_KEY as string,
  config.PINATA_SECRET_KEY as string
);

const pinataPrivateClient = new PinataSDK({
  pinataJwt: config.NEW_PINATA_JWT_KEY as string,
  pinataGateway: config.NEW_PINATA_GATEWAY as string,
});

const formatPublicUploadResponse = (file: PinataPinResponse) => {
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.cid}`,
    ipfsHash: file.cid,
    ipfsStorage: "pinata-public",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

const formatPrivateUploadResponse = (file:any)=>{
  return {
    ipfsUrl: ``,
    ipfsHash: file.cid,
    ipfsStorage: "pinata-private",
    pinSize: file.size,
    timestamp: new Date().toISOString(),
  };
};

interface UploadToPinataOptions {
  name: string;
  attributes?: { trait_type: string; value: string }[];
}


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