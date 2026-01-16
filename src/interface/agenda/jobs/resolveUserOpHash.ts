import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { UserOps, Floppy } from "../../../infra/database/models";
import { publicClient } from "../../../domain/contract/viemClient";
import { pimlicoClient } from "../../../infra/smart-agent/pimlico-client";
import { reportError } from "../../../infra/reporter";
import { config } from "../../../config";
import { IOnChainFloppy } from "../../../types";
import { addStorage } from "../../../domain/limit";

const JOB_NAME = "RESOLVE_USER_OPS";

const MAX_USER_OPS_TO_PROCESS = 10;

const GET_FLOPPY_BY_SHORT_CODE_ABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "shortCode",
        type: "string",
      },
    ],
    name: "getFloppyByShortCode",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "id",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "shortCode",
            type: "string",
          },
          {
            internalType: "uint256",
            name: "groupId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "maxCount",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "diskSpace",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "grantCount",
            type: "uint256",
          },
          {
            internalType: "string",
            name: "metadataURI",
            type: "string",
          },
        ],
        internalType: "struct Floppy.FloppyDisk",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

async function jobDefinition(job: Job, done: (args?: any) => void) {
  try {
    logger.info(`Job ${JOB_NAME} started`);
    await resolveUserOperations();
    logger.info(`Job ${JOB_NAME} completed`);
    done();
  } catch (error) {
    logger.error(`Error in ${JOB_NAME} job:`, error);
    done(error);
  }
}

async function setupJob() {
  agenda.define(JOB_NAME, jobDefinition);
  agenda.every("2 seconds", JOB_NAME);
}

async function resolveUserOperations() {
  const userOps = await UserOps.find({
    isProcessed: false,
  }).limit(MAX_USER_OPS_TO_PROCESS);

  if (userOps.length === 0) {
    logger.info(`No user ops to process`);
    return;
  }

  for (const userOp of userOps) {
    try {
      const userOpHash = userOp.userOpHash;
      const contractAddress = userOp.contractAddress;
      const floppyShortCode = userOp.floppyShortCode;
      const nullifier = userOp.nullifier;

      logger.info(
        `Resolving user op hash ${userOpHash} for floppy ${floppyShortCode} and contract ${contractAddress}`
      );
      const userOpReceipt = await pimlicoClient.waitForUserOperationReceipt({
        hash: userOpHash as `0x${string}`,
        timeout: 1000000,
      });
      logger.info(`User op receipt state: ${userOpReceipt.success}`);

      if (userOpReceipt.success) {
        const { diskSpace } = (await publicClient.readContract({
          address: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
          abi: GET_FLOPPY_BY_SHORT_CODE_ABI,
          functionName: "getFloppyByShortCode",
          args: [floppyShortCode],
        })) as IOnChainFloppy;

        const floppy = await Floppy.findOne({ shortCode: floppyShortCode });
        if (!floppy) {
          throw new Error(`Floppy not found: ${floppyShortCode}`);
        }

        await addStorage({
          contractAddress: contractAddress as string,
          diskSpace: Number(diskSpace),
          shortCode: floppyShortCode,
          supportsMultipleClaims: floppy.supportsMultipleClaims,
        });

        // add nullifier to floppy
        floppy.nullifiers.push(nullifier);
        await floppy.save();

        await UserOps.updateOne(
          { _id: userOp._id },
          { $set: { isProcessed: true } }
        );

        logger.info(
          `User op hash ${userOpHash} resolved for floppy ${floppyShortCode} and contract ${contractAddress}`
        );
      } else {
        reportError(
          `Failed to resolve user op hash: ${userOpHash} for floppy ${floppyShortCode} and contract ${contractAddress}`
        );
      }
    } catch (error) {
      throw error;
    }
  }
}

export default { setupJob, jobDefinition };
