export type UploadBlock = "locked" | "full";

export const uploadBlock = ({
  locked,
  storageFull,
}: {
  locked: boolean;
  storageFull: boolean;
}): UploadBlock | null => {
  if (locked) return "locked";
  if (storageFull) return "full";
  return null;
};
