import { FloppyManager } from "./floppyManager";

export const get = async ({ shortCode }: { shortCode: string }) => {
  const floppyManager = new FloppyManager(shortCode);
  return floppyManager.getFloppy();
};
