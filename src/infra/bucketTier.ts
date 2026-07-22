import { BucketTier, CustomRequest } from "../types";

export const readBucketTier = (req: CustomRequest): BucketTier => {
  const raw = (req.headers["x-bucket-tier"] as string | undefined)?.toLowerCase();
  return raw === BucketTier.WORKSPACE ? BucketTier.WORKSPACE : BucketTier.PERSONAL;
};
