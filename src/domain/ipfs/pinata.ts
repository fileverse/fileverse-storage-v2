import { PassThrough, Readable } from "stream";
import request from "request";
import { config } from "../../config";
import pinataSDK, {
  type PinataPinOptions,
  type PinataPinResponse,
} from "@pinata/sdk";
import { logger } from "../../infra/logger";

const pinataClient = pinataSDK(
  config.PINATA_API_KEY as string,
  config.PINATA_SECRET_KEY as string
);

const formatUploadResponse = (file: PinataPinResponse) => {
  return {
    ipfsUrl: `${config.PINATA_GATEWAY}/${file.IpfsHash}`,
    ipfsHash: file.IpfsHash,
    ipfsStorage: "pinata",
    pinSize: file.PinSize,
    timestamp: file.Timestamp,
  };
};

interface UploadToPinataOptions {
  name: string;
  attributes?: { trait_type: string; value: string }[];
}

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

    return formatUploadResponse(file);
  } catch (err) {
    console.error("error while uploading to pinata", err);
    logger.error(`error while uploading to pinata: ${err}`);
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
