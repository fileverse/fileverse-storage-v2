import { ApiAccessKey } from "../../infra/database/models";

export const remove = async ({
  hashedApiKey,
}: {
  hashedApiKey: string;
}) => {
  const result = await ApiAccessKey.deleteOne({
    id: hashedApiKey,
  });
  return result;
};
