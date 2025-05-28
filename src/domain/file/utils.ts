import { IFile } from "../../types";

export const getFileVisibility = (file: IFile) => {
  return file.tags.includes("private") ? "private" : "public";
};
