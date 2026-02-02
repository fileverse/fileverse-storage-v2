import { ApiAccessKey } from "../../infra/database/models";

export const get = async ({
  hashedApiKey,
}: {
  hashedApiKey: string;
}) => {
  const doc = await ApiAccessKey.findOne({
    id: hashedApiKey,
  });
  return doc;
};
