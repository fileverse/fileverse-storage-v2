// import { list } from "../../domain/floppy";
import { CustomRequest } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { Response } from "express";

const listValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
};

async function listHandler(req: CustomRequest, res: Response) {
  const { contractAddress, invokerAddress, chainId } = req;
  console.log({ contractAddress, invokerAddress, chainId });
  if (!contractAddress || !invokerAddress || !chainId) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }
  try {
    // const dataList = await list({ contractAddress });
    // return res.json({ floppy: dataList });
    return res.json({ success: true, floppy: [{
        shortCode: "FLV",
        name: "Floppy #001",
        description: "Kawai floppy by fileverse!",
        img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy1.png",
        metadataURI: "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
        diskSpace: 1000000000,
      }, {
        shortCode: "OXB",
        name: "OXB #001",
        description: "Floppy for oxford freshers fair participants by fileverse!",
        img: "https://ddocs-new-git-maitra-tec-1139-fileverse.vercel.app/assets/floppy2.png",
        metadataURI: "ipfs://bafkreic3h7bfs4ifq7kz6wot4b7qyqo3uq3plp4pbf37flg2up5joxkfwq",
        diskSpace: 1000000000,
      }]
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
}
export default [validate(listValidation), listHandler];
