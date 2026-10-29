import { Limit } from "../../infra/database/models";
import { getDefaultStorageLimit } from "./getStorageUse";

export const setPortalPro = async (contractAddress: string, pro: boolean) => {
  await Limit.updateOne(
    { contractAddress },
    {
      $set: { pro },
      // A row created here must keep the limit the portal had without a row.
      $setOnInsert: { storageLimit: getDefaultStorageLimit() },
    },
    { upsert: true }
  );
};
