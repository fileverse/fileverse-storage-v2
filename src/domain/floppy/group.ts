import { Floppy } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";

export const group = async ({
  shortCode,
}: {
  shortCode: string;
}) => {
  const floppy = await Floppy.findOne({ shortCode });
  if (!floppy) {
    return throwError({
      code: 404,
      message: "Floppy not found",
    });
  }
  return floppy;
};
