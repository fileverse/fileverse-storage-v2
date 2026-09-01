import { Response } from "express";
import { uploadOnlyPrivate } from "../../domain/upload";
import { create } from "../../domain/file";
import { CustomRequest, FileIPFSType } from "../../types";
import { validate, Joi } from "../middleware";
import { throwError } from "../../infra/errorHandler";
import { logger } from "../../infra/logger";
import { startMark, elapsedMs } from "../../infra/timing";
import { BatchUploadResponse, getIPFSTypeFromFileName } from "../upload/common";
import { warmPrivateGatewayCache } from "./gatewayCache";

const batchUploadValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
  }).unknown(true),
};

// Heroku's router aborts at 30s (H12); warn early enough to see the trend.
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
    const uploaded = await uploadOnlyPrivate({
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

  // Fire-and-forget warm-on-write (uploadPromises preserves files order); a
  // failure here just means a cold first read.
  uploadedFiles.forEach((ipfsFile, i) => {
    if (ipfsFile?.ipfsHash && files[i]?.data) {
      void warmPrivateGatewayCache(ipfsFile.ipfsHash, files[i].data, files[i].mimetype);
    }
  });
  const dbMark = startMark();
  const dbPromises = uploadedFiles.map((ipfsFile) =>
    create({
      appFileId,
      ipfsHash: ipfsFile.ipfsHash,
      gatewayUrl: ipfsFile.ipfsUrl,
      pinataId: ipfsFile.pinataId,
      storageType: ipfsFile.storageType,
      contractAddress,
      invokerAddress,
      fileSize: ipfsFile.fileSize,
      tags: [],
      sourceApp,
      ipfsType: ipfsFile.ipfsType,
    })
  );
  await Promise.all(dbPromises);
  const dbMs = elapsedMs(dbMark);

  const totalMs = elapsedMs(requestMark);
  const totalBytes = files.reduce((sum, file) => sum + file.data.length, 0);
  const timing = {
    event: "batch_upload",
    lane: "private",
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
