import Image from "../../infra/database/models/image";

interface ICreateImageParams {
  hash: string;
  origin: string;
  gateway: string;
  pinataId?: string;
}

export const create = async ({
  hash,
  origin,
  gateway,
  pinataId,
}: ICreateImageParams) => {
  const image = new Image({
    hash,
    origin,
    gateway,
    ...(pinataId ? { pinataId } : {}),
  });

  return image.save();
};
