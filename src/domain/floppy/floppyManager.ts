import { Floppy } from "../../infra/database/models";
import { throwError } from "../../infra/errorHandler";
import { config } from "../../config";

import { DBFloppyDocument, IOnChainFloppy } from "../../types";
import { encodeFunctionData, Hex } from "viem";
import { FLOPPY_CONTRACT_ABI } from "../../data/floppyContractAbi";
import { AgentInstance } from "../../infra/smart-agent";
import { SemaphoreProof, verifyProof } from "@semaphore-protocol/proof";
import { decodeMessage } from "@semaphore-protocol/utils";
import { addStorage } from "../limit/addStorage";
import { publicClient } from "../contract/viemClient";
import { SIMPLE_MANAGER_ABI } from "../../data/simpleManagerAbi";
import { getGroupMembers } from "./semaphoreSubgraph";

export class FloppyManager {
  shortCode: string;

  constructor(shortCode: string) {
    this.shortCode = shortCode;
  }

  async getFloppy() {
    const floppy = await Floppy.findOne({ shortCode: this.shortCode });
    if (!floppy) {
      return throwError({
        code: 404,
        message: "Floppy not found",
      });
    }
    return floppy;
  }

  async getGroup() {
    const floppy = await this.getFloppy();
    if (floppy.offchain) return floppy.toJSON();
    const members = await getGroupMembers(floppy.sgid);

    return {
      ...floppy.toJSON(),
      members,
    };
  }

  async claimFloppy(identityCommitment: string) {
    const floppy = await this.getFloppy();
    if (floppy.offchain) return this.claimOffChain(identityCommitment, floppy);
    return this._claimOnChain(identityCommitment, floppy);
  }

  async redeemFloppy(proof: SemaphoreProof, contractAddress: Hex) {
    const floppy = await this.getFloppy();
    if (floppy.offchain)
      return this.redeemOffChain(proof, floppy, contractAddress);
    return this.redeemOnChain(proof, floppy, contractAddress);
  }

  // REDEEM OFF CHAIN LOGIC
  private async redeemOffChain(
    proof: SemaphoreProof,
    floppy: DBFloppyDocument,
    contractAddress: Hex
  ) {
    if (floppy.nullifiers.includes(proof.nullifier)) {
      return throwError({
        code: 400,
        message: "Code already redeemed",
      });
    }
    const valid = await verifyProof(proof as any);
    if (!valid) {
      return throwError({
        code: 400,
        message: "Invalid proof",
      });
    }
    const decodedMessage = decodeMessage(proof.message);
    if (decodedMessage === `Redeem ${this.shortCode}`) {
      // add storage to corresponding portal
      await addStorage({
        contractAddress: contractAddress as string,
        diskSpace: floppy.diskSpace,
        shortCode: this.shortCode,
        supportsMultipleClaims: floppy.supportsMultipleClaims,
      });
      // add nullifier to floppy
      floppy.nullifiers.push(proof.nullifier);
      await floppy.save();
    } else {
      return throwError({
        code: 400,
        message: "Invalid message",
      });
    }
    return true;
  }

  // REDEEM ON CHAIN LOGIC
  private async redeemOnChain(
    proof: SemaphoreProof,
    floppy: DBFloppyDocument,
    contractAddress: Hex
  ) {
    try {
      const {
        merkleTreeDepth,
        merkleTreeRoot,
        nullifier,
        message,
        scope,
        points,
      } = proof;

      if (floppy.nullifiers.includes(nullifier)) {
        return throwError({
          code: 400,
          message: "Code already redeemed",
        });
      }

      const encodedCallData = encodeFunctionData({
        abi: FLOPPY_CONTRACT_ABI,
        functionName: "claimFloppy",
        args: [
          floppy.onChainFloppyId,
          [merkleTreeDepth, merkleTreeRoot, nullifier, message, scope, points],
        ],
      });

      const userOp = await AgentInstance.executeUserOperationRequest(
        {
          contractAddress: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
          data: encodedCallData,
        },
        1000000
      );

      if (!userOp.success) {
        return throwError({
          code: 500,
          message: "Failed to claim floppy",
        });
      }

      const { diskSpace } = (await publicClient.readContract({
        address: config.FLOPPY_CONTRACT_ADDRESS as `0x${string}`,
        abi: FLOPPY_CONTRACT_ABI,
        functionName: "getFloppyByShortCode",
        args: [this.shortCode],
      })) as IOnChainFloppy;

      await addStorage({
        contractAddress: contractAddress as string,
        diskSpace: Number(diskSpace),
        shortCode: this.shortCode,
        supportsMultipleClaims: floppy.supportsMultipleClaims,
      });

      // add nullifier to floppy
      floppy.nullifiers.push(proof.nullifier);
      await floppy.save();

      return true;
    } catch (err) {
      console.error(err);
      return throwError({
        code: 500,
        message: "Failed to claim floppy",
      });
    }
  }

  // CLAIM OFF CHAIN LOGIC
  private async claimOffChain(
    identityCommitment: string,
    floppy: DBFloppyDocument
  ) {
    floppy.members.push(identityCommitment);
    await floppy.save();
    return true;
  }

  // CLAIM ON CHAIN LOGIC (INTERNAL USE ONLY)
  private async _claimOnChain(
    identityCommitment: string,
    floppy: DBFloppyDocument
  ) {
    if (!floppy.onChainFloppyId) {
      return throwError({
        code: 400,
        message: "Invalid on chain floppy",
      });
    }
    try {
      const encodedCallData = encodeFunctionData({
        abi: SIMPLE_MANAGER_ABI,
        functionName: "grantFloppyAccess",
        args: [floppy.shortCode, [identityCommitment]],
      });

      const userOp = await AgentInstance.executeUserOperationRequest(
        {
          contractAddress: config.MANAGER_CONTRACT_ADDRESS as `0x${string}`,
          data: encodedCallData,
        },
        1000000
      );
      if (!userOp.success) {
        return throwError({
          code: 500,
          message: "Failed to claim floppy",
        });
      }
      floppy.members.push(identityCommitment);
      await floppy.save();
      return true;
    } catch (error) {
      console.error(error);
      return throwError({
        code: 500,
        message: "Failed to claim floppy",
      });
    }
  }
}
