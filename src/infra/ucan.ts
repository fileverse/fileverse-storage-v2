import {
  getCollaboratorKeys,
  getLegacyCollaboratorKeys,
  isLegacyContract,
} from "../domain/contract";
import { v4 as uuidv4 } from "uuid";
import { Hex } from "viem";
import { NextFunction, Response } from "express";
import { CustomRequest } from "../types";
import {
  validateInvokerAddress,
  validateContracts,
  extractClaimedRootIssuer,
} from "./ucanUtils";
import { cache } from "./cache";

type Fetcher = "current" | "legacy" | null;

async function validateContractAddress(
  contractAddresses: Hex[],
  invokerAddress: Hex,
  token: string
) {
  const contracts: Array<{
    contractAddress: Hex;
    invokerDid: string | null;
    fetcher: Fetcher;
    isLegacy: boolean;
  }> = [];

  for (const contractAddress of contractAddresses) {
    const isLegacy = Boolean(await isLegacyContract(contractAddress));
    let invokerDid: string | null;
    let fetcher: Fetcher;

    if (isLegacy) {
      invokerDid = (await getLegacyCollaboratorKeys(
        invokerAddress,
        contractAddress
      )) as string | null;
      fetcher = invokerDid ? "legacy" : null;
    } else {
      invokerDid = (await getCollaboratorKeys(
        invokerAddress,
        contractAddress
      )) as string | null;
      fetcher = invokerDid ? "current" : null;
      if (!invokerDid) {
        invokerDid = (await getLegacyCollaboratorKeys(
          invokerAddress,
          contractAddress
        )) as string | null;
        fetcher = invokerDid ? "legacy" : null;
      }
    }

    contracts.push({ contractAddress, invokerDid, fetcher, isLegacy });
  }

  const firstAttempt = await validateContracts(
    contracts.map(({ contractAddress, invokerDid }) => ({
      contractAddress,
      invokerDid,
    })),
    token
  );
  if (firstAttempt.ok) return firstAttempt;

  // Guarded refetch: a cached collaborator DID may be stale after an on-chain
  // key rotation. Only re-read on-chain when the token's claimed issuer
  // doesn't match the cached DID — i.e. the rotation signature. This avoids
  // RPC amplification on genuinely invalid tokens.
  const claimedIssuer = extractClaimedRootIssuer(token);
  if (!claimedIssuer) return firstAttempt;

  // If every contract's DID is already known and the claimed issuer matches
  // one of them, the token is "for" a known collaborator and verify failed
  // for a non-rotation reason (capability mismatch, expired, etc.). Skip the
  // refetch. We require every entry to be known because a null cache slot is
  // itself "haven't looked yet" — a newly-added collaborator on another
  // portal would otherwise stay invisible.
  const allCachedKnown = contracts.every((c) => c.invokerDid !== null);
  if (
    allCachedKnown &&
    contracts.some((c) => c.invokerDid?.toLocaleLowerCase() === claimedIssuer?.toLocaleLowerCase())
  ) {
    return firstAttempt;
  }

  let anyRefetched = false;
  const refreshed: Array<{ contractAddress: Hex; invokerDid: string | null }> =
    [];

  for (const { contractAddress, invokerDid: cachedDid, fetcher, isLegacy } of contracts) {
    if (cachedDid && cachedDid.toLocaleLowerCase() === claimedIssuer.toLocaleLowerCase()) {
      refreshed.push({ contractAddress, invokerDid: cachedDid });
      continue;
    }

    console.log("ucan: refetch on issuer mismatch", {
      invokerAddress,
      contractAddress,
    });
    cache.del(`collaboratorKeys:${invokerAddress}:${contractAddress}`);

    let fresh: string | null;
    if (fetcher === "legacy" || isLegacy) {
      fresh = (await getLegacyCollaboratorKeys(invokerAddress, contractAddress, {
        bypassCache: true,
      })) as string | null;
    } else {
      fresh = (await getCollaboratorKeys(invokerAddress, contractAddress, {
        bypassCache: true,
      })) as string | null;
      if (!fresh) {
        fresh = (await getLegacyCollaboratorKeys(
          invokerAddress,
          contractAddress,
          { bypassCache: true }
        )) as string | null;
      }
    }

    if (fresh && fresh !== cachedDid) anyRefetched = true;
    refreshed.push({ contractAddress, invokerDid: fresh });
  }

  if (!anyRefetched) return firstAttempt;

  return validateContracts(refreshed, token);
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

  if (contractAddresses.length > 0) {
    const { ok, actualContractAddress } = await validateContractAddress(
      contractAddresses as Hex[],
      invokerAddress as Hex,
      token
    );
    req.isAuthenticated = ok;
    req.contractAddress = actualContractAddress as Hex;
  } else {
    req.isAuthenticated = await validateInvokerAddress(
      invokerAddress as Hex,
      token
    );
  }

  next();
};

export { verify, validateContractAddress };
