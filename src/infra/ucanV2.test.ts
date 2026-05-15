jest.mock("../domain/contract/viemClient", () => ({
  publicClient: { readContract: jest.fn() },
}));
jest.mock("./cache", () => ({
  cache: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));
jest.mock("ucans", () => ({ verify: jest.fn() }));

import { Hex } from "viem";
import { publicClient } from "../domain/contract/viemClient";
import { cache } from "./cache";
import * as ucans from "ucans";
import { ContractMeta } from "../types";
import { portalAbi } from "../domain/contract/abi";
import { validateContractAddressV2 } from "./ucanV2";

describe("validateContractAddressV2 — verify-on-mismatch", () => {
  const readContract = publicClient.readContract as jest.Mock;
  const cacheGet = cache.get as jest.Mock;
  const cacheSet = cache.set as jest.Mock;
  const cacheDel = cache.del as jest.Mock;
  const ucansVerify = ucans.verify as jest.Mock;

  const INVOKER: Hex = "0x56D2000f7cFf923E74388E6185128741cd063A23";
  const PORTAL: Hex = "0x1A592FAf20Dd976fcbb5Fc829d504F2bfbE87E3B";
  const OLD_DID = "did:key:zOldStaleDid";
  const NEW_DID = "did:key:zNewRotatedDid";
  const CACHE_KEY = `collaboratorKeys:${INVOKER}:${PORTAL}`;
  const CACHE_TTL_SECONDS = 60 * 60 * 24;
  const META: ContractMeta[] = [{ contractAddress: PORTAL, version: "v2" }];

  const verifyArgsFor = (rootIssuer: string) => ({
    audience: "did:key:zTestService",
    requiredCapabilities: [
      {
        capability: {
          with: { scheme: "storage", hierPart: PORTAL.toLowerCase() },
          can: { namespace: "file", segments: ["CREATE"] },
        },
        rootIssuer,
      },
    ],
  });

  const readContractArgs = {
    address: PORTAL,
    abi: portalAbi,
    functionName: "collaboratorKeys",
    args: [INVOKER],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stale cache + on-chain rotation: busts cache, refetches, retries, succeeds", async () => {
    const token = "ucan-signed-by-new-did";
    cacheGet.mockResolvedValueOnce(OLD_DID);
    ucansVerify
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    readContract.mockResolvedValueOnce(NEW_DID);

    const result = await validateContractAddressV2(META, INVOKER, token);

    // Execution order: cache.get → verify (OLD_DID, fails) → cache.del →
    // readContract → cache.set → verify (NEW_DID, succeeds) → return.
    expect(cacheGet).toHaveBeenCalledWith(CACHE_KEY);
    expect(ucansVerify).toHaveBeenNthCalledWith(1, token, verifyArgsFor(OLD_DID));
    expect(cacheDel).toHaveBeenCalledWith(CACHE_KEY);
    expect(readContract).toHaveBeenCalledWith(readContractArgs);
    expect(cacheSet).toHaveBeenCalledWith(CACHE_KEY, NEW_DID, CACHE_TTL_SECONDS);
    expect(ucansVerify).toHaveBeenNthCalledWith(2, token, verifyArgsFor(NEW_DID));
    expect(ucansVerify).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL });
  });

  it("steady-state cache hit: no chain read, no cache bust", async () => {
    const token = "ucan-signed-by-cached-did";
    cacheGet.mockResolvedValueOnce(NEW_DID);
    ucansVerify.mockResolvedValueOnce({ ok: true });

    const result = await validateContractAddressV2(META, INVOKER, token);

    expect(cacheGet).toHaveBeenCalledWith(CACHE_KEY);
    expect(ucansVerify).toHaveBeenCalledWith(token, verifyArgsFor(NEW_DID));
    expect(ucansVerify).toHaveBeenCalledTimes(1);
    expect(readContract).not.toHaveBeenCalled();
    expect(cacheDel).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL });
  });

  it("no actual rotation: cached DID still matches chain, verification still fails", async () => {
    const token = "ucan-with-mismatched-issuer";
    cacheGet.mockResolvedValueOnce(OLD_DID);
    ucansVerify.mockResolvedValueOnce({ ok: false });
    readContract.mockResolvedValueOnce(OLD_DID);

    const result = await validateContractAddressV2(META, INVOKER, token);

    // Execution order: cache.get → verify (OLD_DID, fails) → cache.del →
    // readContract (returns OLD_DID, same as cached) → cache.set → loop
    // continues because freshDid === cachedDid → no second verify call → return failure.
    expect(cacheGet).toHaveBeenCalledWith(CACHE_KEY);
    expect(ucansVerify).toHaveBeenCalledWith(token, verifyArgsFor(OLD_DID));
    expect(cacheDel).toHaveBeenCalledWith(CACHE_KEY);
    expect(readContract).toHaveBeenCalledWith(readContractArgs);
    expect(cacheSet).toHaveBeenCalledWith(CACHE_KEY, OLD_DID, CACHE_TTL_SECONDS);
    expect(ucansVerify).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, actualContractAddress: PORTAL });
  });
});
