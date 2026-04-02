import {
  getCollaboratorKeys,
  getLegacyCollaboratorKeys,
} from "../domain/contract";
import { v4 as uuidv4 } from "uuid";
import { Hex } from "viem";
import { NextFunction, Response } from "express";
import { ContractMeta, CustomRequest } from "../types";
import {
  ValidationResult,
  validateInvokerAddress,
  validateContracts,
} from "./ucanUtils";

async function validateContractAddressV2(
  contractMeta: ContractMeta[],
  invokerAddress: Hex,
  token: string
): Promise<ValidationResult> {
  const metaToValidate = contractMeta.some((m) => m.version !== "v1")
    ? contractMeta.filter((m) => m.version !== "v1")
    : contractMeta;

  const contracts = [];
  for (const { contractAddress, version } of metaToValidate) {
    // Use version from meta to pick the right resolver — no on-chain isLegacy check needed
    const invokerDid =
      version === "v1"
        ? await getLegacyCollaboratorKeys(invokerAddress, contractAddress)
        : await getCollaboratorKeys(invokerAddress, contractAddress);
    contracts.push({ contractAddress, invokerDid: invokerDid as string | null });
  }
  return validateContracts(contracts, token);
}


const verifyV2 = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const contractMetaHeader = req.headers["x-contract-meta"] as string;
  const invokerAddress = req.headers["x-invoker-address"] as string;
  const chainId = req.headers["chain"] as string;

  req.requestId = uuidv4();
  req.isAuthenticated = false;
  req.invokerAddress = invokerAddress;
  req.chainId = chainId;

  let contractMeta: ContractMeta[] = [];
  if (contractMetaHeader) {
    try {
      const decoded = Buffer.from(contractMetaHeader, "base64").toString(
        "utf-8"
      );
      contractMeta = JSON.parse(decoded) as ContractMeta[];
    } catch (err) {
      console.error("Failed to decode x-contract-meta header:", err);
    }
  }

  req.contractMeta = contractMeta;
  req.contractAddresses = contractMeta.map((m) => m.contractAddress);
  req.contractAddress = contractMeta[0]?.contractAddress ?? null;

  console.log("req.requestId: ", req.requestId);

  let token = req.headers["authorization"] as string;
  if (!token || !invokerAddress) {
    return next();
  }

  token = token.startsWith("Bearer ") ? token.slice(7) : token;

  if (contractMeta.length > 0) {
    const { ok, actualContractAddress } = await validateContractAddressV2(
      contractMeta,
      invokerAddress as Hex,
      token
    );
    req.isAuthenticated = ok;
    req.contractAddress = actualContractAddress;
  } else {
    req.isAuthenticated = await validateInvokerAddress(
      invokerAddress as Hex,
      token
    );
  }

  next();
};

export { verifyV2 };
