import { uploadPrivate as uploadPrivateToPinata, uploadPublic as uploadPublicToPinata } from "./ipfs";
import { create as createImage } from "./image";
import { config } from "../config"

interface IUploadImageParams {
  file: {
    name: string;
    mimetype: string;
    data: Buffer;
  };
  origin: string;
}

export const uploadImage = async ({
  file,
  origin,
}: IUploadImageParams) => {
  const { name, mimetype, data } = file;

  const ipfsFile = await uploadPublicToPinata({
    name,
    mimetype,
    data,
  });

  await createImage({
    hash: ipfsFile.ipfsHash,
    origin,
    gateway: config.PINATA_GATEWAY!,
  });

  return {
    url: ipfsFile.ipfsUrl,
    hash: ipfsFile.ipfsHash,
  };
};

export const uploadPrivateImage = async ({
  file,
  origin,
}: IUploadImageParams) => {
  const { name, mimetype, data } = file;

  const ipfsFile = await uploadPrivateToPinata({
    name,
    mimetype,
    data,
  });

  await createImage({
    hash: ipfsFile.ipfsHash,
    origin,
    gateway: config.PINATA_GATEWAY!,
    pinataId: ipfsFile.pinataId,
  });

  // No URL on the private lane — clients derive the byte-proxy URL from the
  // hash themselves.
  return {
    url: "",
    hash: ipfsFile.ipfsHash,
  };
};
