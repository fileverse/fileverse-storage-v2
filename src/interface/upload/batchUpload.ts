import { Response } from "express";

import { uploadOnly } from "../../domain/upload";
import { create } from "../../domain/file";
import { CustomRequest, FileIPFSType } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { logger } from "../../infra/logger";
import { startMark, elapsedMs } from "../../infra/timing";
import { BatchUploadResponse, getIPFSTypeFromFileName } from "./common";

const batchUploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
  }).unknown(true),
};

// Heroku's router aborts at 30s (H12). Logging slow-but-successful uploads at
// warn level makes the approach to that ceiling searchable before it starts
// costing requests.
const SLOW_UPLOAD_MS = 10_000;

const batchUploadFn = async (req: CustomRequest, res: Response) => {
  const { contractAddress, invokerAddress } = req;
  const files = Array.isArray(req.files?.files) ? req.files?.files : [];
  const { appFileId, sourceApp } = req.body;

  if (!contractAddress || !invokerAddress || !files || files?.length === 0) {
    return throwError({
      code: 400,
      message: "Invalid request",
      req,
    });
  }

  const requestMark = startMark();

  // Files pin concurrently, so the phase takes as long as the SLOWEST file:
  // time each one separately or a single straggler is indistinguishable from
  // everything being slow.
  const perFile: { ipfsType: string; bytes: number; ms: number }[] = [];
  const ipfsMark = startMark();
  const uploadPromises = files.map(async (file) => {
    const fileMark = startMark();
    const uploaded = await uploadOnly({
      file,
      appFileId,
      sourceApp,
      ipfsType: getIPFSTypeFromFileName(file.name),
      contractAddress,
      invokerAddress,
      tags: [],
    });
    perFile.push({
      ipfsType: uploaded.ipfsType,
      bytes: file.data.length,
      ms: elapsedMs(fileMark),
    });
    return uploaded;
  });
  const uploadedFiles = await Promise.all(uploadPromises);
  const ipfsMs = elapsedMs(ipfsMark);

  const dbPromises = uploadedFiles.map((ipfsFile) =>
    create({
      appFileId,
      ipfsHash: ipfsFile.ipfsHash,
      gatewayUrl: ipfsFile.ipfsUrl,
      pinataId: ipfsFile.pinataId,
      contractAddress,
      invokerAddress,
      fileSize: ipfsFile.fileSize,
      tags: [],
      sourceApp,
      ipfsType: ipfsFile.ipfsType,
      storageType: ipfsFile.storageType,
    })
  );
  const dbMark = startMark();
  await Promise.all(dbPromises);
  const dbMs = elapsedMs(dbMark);

  const totalMs = elapsedMs(requestMark);
  const totalBytes = files.reduce((sum, file) => sum + file.data.length, 0);
  const timing = {
    event: "batch_upload",
    lane: "public",
    requestId: req.requestId,
    contractAddress,
    appFileId,
    sourceApp,
    fileCount: files.length,
    totalBytes,
    ipfsMs,
    dbMs,
    totalMs,
    files: perFile,
  };
  const summary = `batch upload ${totalMs}ms (ipfs ${ipfsMs}ms, db ${dbMs}ms, ${files.length} files, ${totalBytes}B)`;
  if (totalMs >= SLOW_UPLOAD_MS) {
    logger.warn(timing, `SLOW ${summary}`);
  } else {
    logger.info(timing, summary);
  }

  const response: BatchUploadResponse = {
    gateIpfsHash: "",
    contentIpfsHash: "",
    metadataIpfsHash: "",
  };

  for (const file of uploadedFiles) {
    if (file.ipfsType === FileIPFSType.GATE) {
      response.gateIpfsHash = file.ipfsHash;
    } else if (file.ipfsType === FileIPFSType.CONTENT) {
      response.contentIpfsHash = file.ipfsHash;
    } else if (file.ipfsType === FileIPFSType.METADATA) {
      response.metadataIpfsHash = file.ipfsHash;
    }
  }

  res.json(response);
};

export default [validate(batchUploadValidation), batchUploadFn];