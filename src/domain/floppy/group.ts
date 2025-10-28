import { FloppyManager } from "./floppyManager";

export const group = async ({ shortCode }: { shortCode: string }) => {
  const floppyManager = new FloppyManager(shortCode);
  return floppyManager.getGroup();
};
