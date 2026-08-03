import Image from "../../infra/database/models/image";

interface ICreateImageParams {
  hash: string;
  origin: string;
  gateway: string;
  apiKey: string;
  pinataId?: string;
}

export const create = async ({
  hash,
  origin,
  gateway,
  apiKey,
  pinataId,
}: ICreateImageParams) => {
  const image = new Image({
    hash,
    origin,
    gateway,
    apiKey,
    ...(pinataId ? { pinataId } : {}),
  });

  return image.save();
};
