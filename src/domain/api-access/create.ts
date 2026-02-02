import { ApiAccessKey } from "../../infra/database/models";

export const create = async ({
  id,
  encryptedKeyMaterial,
  encryptedAppMaterial,
}: {
  id: string;
  encryptedKeyMaterial: string;
  encryptedAppMaterial: string;
}) => {
  const doc = await ApiAccessKey.findOneAndUpdate(
    { id },
    {
      id,
      encryptedKeyMaterial,
      encryptedAppMaterial,
      timeStamp: Date.now(),
    },
    { upsert: true, new: true }
  );
  return doc;
};
