import { Floppy } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";

export const claim = async ({
  shortCode,
  identityCommitment,
}: {
  shortCode: string;
  identityCommitment: string;
}) => {
  const floppy = await Floppy.findOne({ shortCode });
  if (!floppy) {
    return throwError({
      code: 404,
      message: "Floppy not found",
    });
  }
  floppy.members.push(identityCommitment);
  await floppy.save();
  return true;
};
