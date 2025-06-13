import { list } from "../../domain/communityFiles";
import { Response } from "express";
import { Joi, validate } from "../middleware";
import { CustomRequest } from "../../types";
// TODO: add validation
// const listValidation = {
//   query: Joi.object({
//     page: Joi.number().optional(),
//     limit: Joi.number().optional(),
//     category: Joi.string().optional(),
//     search: Joi.string().optional(),
//     onlyFavorites: Joi.boolean().optional(),
//   }),
//   headers: Joi.object({
//     invoker: Joi.string().optional(),
//   }),
// };

const getList = async (req: CustomRequest, res: Response) => {
  const { page, limit, category, search, onlyFavorites } = req.query;
  const { invokerAddress } = req;
  const files = await list({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    category: category?.toString(),
    search: search?.toString(),
    onlyFavorites: onlyFavorites ? onlyFavorites === "true" : undefined,
    invokerAddress: invokerAddress ? invokerAddress : undefined,
  });
  res.json(files);
};

export default [getList];
