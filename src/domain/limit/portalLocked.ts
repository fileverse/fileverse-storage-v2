import { Limit } from "../../infra/database/models";

export const isPortalLocked = async (
  contractAddress: string
): Promise<boolean> =>
  (await Limit.exists({
    contractAddress: contractAddress.toLowerCase(),
    locked: true,
  })) !== null;
