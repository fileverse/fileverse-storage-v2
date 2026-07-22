import mongoose from "mongoose";
import { Limit } from "../src/infra/database/models";
import { BucketTier } from "../src/types";

const main = async () => {
  const result = await Limit.updateMany(
    { tier: { $exists: false } },
    { $set: { tier: BucketTier.PERSONAL } }
  );

  console.log(
    `Backfilled tier='${BucketTier.PERSONAL}' on ${result.modifiedCount} Limit rows (matched ${result.matchedCount}).`
  );
};

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Backfill failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  });
