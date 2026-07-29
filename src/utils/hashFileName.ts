import crypto from "crypto";
import path from "path";

export const hashFilename = (filename: string): string => {
  const extension = path.extname(filename);
  const nameWithoutExtension = path.basename(filename, extension);

  const hashedName = crypto
    .createHash("sha256")
    .update(nameWithoutExtension)
    .digest("hex");

  return `${hashedName}${extension}`;
};