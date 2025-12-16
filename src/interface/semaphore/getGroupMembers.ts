import { Request, Response } from "express";
import { getGroupMembers } from "../../domain/floppy/semaphoreSubgraph";

const getGroupMembersHandler = async (req: Request, res: Response) => {
  const { groupId } = req.params;
  const groupMembers = await getGroupMembers(groupId);
  return res.json({ groupMembers });
};

export default [getGroupMembersHandler];
