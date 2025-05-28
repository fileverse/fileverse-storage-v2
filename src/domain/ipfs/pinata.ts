import { PassThrough, Readable } from "stream";
import request from "request";
import { config } from "../../config";
import pinataSDK, {
  type PinataPinOptions,
  type PinataPinResponse,
} from "@pinata/sdk";

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
    console.log("error while uploading to pinata", err);
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
    console.log("error while unpinning from pinata", err);
    throw err;
  }
};

// class Pinata extends IpfsStorageInterface {
//   constructor() {
//     super();
//     this.apiKey = config.PINATA_API_KEY;
//     this.secretApiKey = config.PINATA_SECRET_KEY;
//     this.pinataGateway =
//       config.PINATA_GATEWAY || "https://ipfs.fileverse.io/ipfs";
//     this.pinata = pinataSDK(this.apiKey, this.secretApiKey);
//   }

//   formatFile(file) {
//     return {
//       ipfsUrl: `${this.pinataGateway}/${file.IpfsHash}`,
//       ipfsHash: file.IpfsHash,
//       ipfsStorage: "pinata",
//       pinSize: file.PinSize,
//       timestamp: file.Timestamp,
//     };
//   }

//   async upload(readableStreamForFile, { name, attributes, filesize }) {
//     const keyvalues = {};
//     (attributes || []).forEach((attribute) => {
//       keyvalues[attribute.trait_type] = attribute.value;
//     });
//     const options = {
//       pinataMetadata: {
//         name,
//         keyvalues,
//       },
//       pinataOptions: {
//         cidVersion: 0,
//       },
//     };

//     try {
//       console.time("Upload to Pinata duration");
//       const file = await this.pinata.pinFileToIPFS(
//         readableStreamForFile,
//         options
//       );
//       console.timeEnd("Upload to Pinata duration");
//       return this.formatFile(file);
//     } catch (e) {
//       console.log("error while uploading to pinata", e);
//       throw e;
//     }
//   }

//   async get({ ipfsUrl }) {
//     if (!ipfsUrl) {
//       return null;
//     }
//     const ipfsStream = new PassThrough();
//     request(ipfsUrl).pipe(ipfsStream);
//     return ipfsStream;
//   }

//   async unPinFile(ipfsHash) {
//     try {
//       await this.pinata.unpin(ipfsHash);
//     } catch (e) {
//       console.log(e.reason);
//     }
//   }

//   async remove({ ipfsHash }) {
//     if (!ipfsHash) {
//       return null;
//     }
//     return this.unPinFile(ipfsHash);
//   }
// }

// module.exports = Pinata;
