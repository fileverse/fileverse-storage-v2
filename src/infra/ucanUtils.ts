import { config } from "../config";
import * as ucans from "ucans";
import { Hex } from "viem";

const serviceDID = config.SERVICE_DID as string;

export interface ValidationResult {
  ok: boolean;
  actualContractAddress: Hex | null;
}

export async function validateInvokerAddress(
  invokerAddress: Hex,
  token: string
) {
  try {
    const result = await ucans.verify(token, {
      audience: serviceDID,
      requiredCapabilities: [
        {
          capability: {
            with: { scheme: "storage", hierPart: invokerAddress },
            can: { namespace: "file", segments: ["CREATE", "GET"] },
          },
          rootIssuer: invokerAddress,
        },
      ],
    });
    return result.ok;
  } catch (error) {
    console.error("Error verifying UCAN with invoker address:", error);
    return false;
  }
}

export async function validateContracts(
  contracts: Array<{ contractAddress: string; invokerDid: string | null }>,
  token: string
): Promise<ValidationResult> {
  const result: ValidationResult = { ok: false, actualContractAddress: null };
  for (const { contractAddress, invokerDid } of contracts) {
    if (invokerDid) {
      const verificationResult = await verifyUcanForContract(
        token,
        contractAddress,
        invokerDid
      );
      result.ok = verificationResult.ok;
      result.actualContractAddress = verificationResult.actualContractAddress;
    }
    if (result.ok) return result;
  }
  return result;
}

export async function verifyUcanForContract(
  token: string,
  contractAddress: string,
  invokerDid: string
): Promise<ValidationResult> {
  const result: ValidationResult = { ok: false, actualContractAddress: null };
  try {
    const verificationResult = await ucans.verify(token, {
      audience: serviceDID,
      requiredCapabilities: [
        {
          capability: {
            with: {
              scheme: "storage",
              hierPart: contractAddress.toLowerCase(),
            },
            can: { namespace: "file", segments: ["CREATE"] },
          },
          rootIssuer: invokerDid,
        },
      ],
    });
    result.ok = verificationResult.ok;
    result.actualContractAddress = contractAddress as Hex;
  } catch (err) {
    console.error("Error verifying UCAN with contract address:", err);
  }
  return result;
}
