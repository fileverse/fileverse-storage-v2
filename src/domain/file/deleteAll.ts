import { File } from "../../infra/database/models";

interface IDeleteAllCriteria {
  appFileId: string;
  contractAddress: string;
}

export const deleteAll = async (criteria: IDeleteAllCriteria) => {
  return await File.updateMany(
    { ...criteria, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );
};
