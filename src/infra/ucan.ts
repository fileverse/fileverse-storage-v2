import { config } from "../config";
import {
  getCollaboratorKeys,
  getLegacyCollaboratorKeys,
} from "../domain/contract";
import { v4 as uuidv4 } from "uuid";
import * as ucans from "ucans";
import { Hex } from "viem";
import { NextFunction, Response } from "express";
import { CustomRequest } from "../types";

const serviceDID = config.SERVICE_DID as string;

async function validateContractAddress(
  contractAddress: Hex,
  invokerAddress: Hex,
  token: string
) {
  let invokerDid = null;
  let isLegacyContract = false;

  invokerDid = await getCollaboratorKeys(invokerAddress, contractAddress);

  if (!invokerDid) {
    invokerDid = await getLegacyCollaboratorKeys(
      invokerAddress,
      contractAddress
    );
    isLegacyContract = true;
  }

  if (!invokerDid) {
    return {
      ok: false,
      isLegacyContract,
    };
  }

  try {
    const result = await ucans.verify(token, {
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
          rootIssuer: invokerDid as string,
        },
      ],
    });
    return {
      ok: result.ok,
      isLegacyContract,
    };
  } catch (error) {
    console.error("Error verifying UCAN with contract address:", error);
    return {
      ok: false,
      isLegacyContract,
    };
  }
}

async function validateInvokerAddress(invokerAddress: Hex, token: string) {
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

const verify = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const contractAddress = req.headers["contract"] as string;
  const invokerAddress = req.headers["invoker"] as string;
  const chainId = req.headers["chain"] as string;

  req.requestId = uuidv4();
  req.isAuthenticated = false;
  req.invokerAddress = invokerAddress;
  const contractAddresses = contractAddress ? contractAddress.split(",") : [];

  req.contractAddress = contractAddresses[0];
  if (contractAddresses.length > 0) {
    req.contractAddresses = contractAddresses;
  }
  req.chainId = chainId;
  console.log("req.requestId: ", req.requestId);

  // Express headers are auto converted to lowercase
  let token = req.headers["authorization"] as string;
  if (!token || !invokerAddress) {
    return next();
  }

  token = token.startsWith("Bearer ") ? token.slice(7, token.length) : token;

  if (contractAddress) {
    const { ok, isLegacyContract } = await validateContractAddress(
      req.contractAddress as Hex,
      invokerAddress as Hex,
      token
    );
    req.isAuthenticated = ok;
    req.isLegacyContract = isLegacyContract;
  } else {
    req.isAuthenticated = await validateInvokerAddress(
      invokerAddress as Hex,
      token
    );
  }

  next();
};

export { verify };
