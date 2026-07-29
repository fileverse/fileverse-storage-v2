import Image from "../../infra/database/models/image";

interface ICreateImageParams {
  hash: string;
  origin: string;
  gateway: string;
  apiKey: string;
}

export const create = async ({
  hash,
  origin,
  gateway,
  apiKey,
}: ICreateImageParams) => {
  const image = new Image({
    hash,
    origin,
    gateway,
    apiKey,
  });

  return image.save();
};