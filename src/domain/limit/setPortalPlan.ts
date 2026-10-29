import { Limit } from "../../infra/database/models";
import { getDefaultStorageLimit } from "./getStorageUse";

export const setPortalPlan = async (
  contractAddress: string,
  plan: { pro: boolean; locked: boolean }
) => {
  await Limit.updateOne(
    { contractAddress },
    {
      $set: { pro: plan.pro, locked: plan.locked },
      // A row created here must keep the limit the portal had without a row.
      $setOnInsert: { storageLimit: getDefaultStorageLimit() },
    },
    { upsert: true }
  );
};
