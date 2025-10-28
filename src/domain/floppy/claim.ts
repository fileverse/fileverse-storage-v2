import { FloppyManager } from "./floppyManager";

export const claim = async ({
  shortCode,
  identityCommitment,
}: {
  shortCode: string;
  identityCommitment: string;
}) => {
  const floppyManager = new FloppyManager(shortCode);
  return floppyManager.claimFloppy(identityCommitment);
};
