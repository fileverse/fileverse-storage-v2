process.env.SERVICE_DID =
  process.env.SERVICE_DID || "did:key:zTestService";

jest.mock("../domain/contract/viemClient", () => ({
  publicClient: { readContract: jest.fn() },
}));

jest.mock("./cache", () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("ucans", () => ({
  verify: jest.fn(),
}));

import { Hex } from "viem";
import { publicClient } from "../domain/contract/viemClient";
import { cache } from "./cache";
import * as ucans from "ucans";
import { ContractMeta } from "../types";
import { validateContractAddressV2 } from "./ucanV2";

const readContract = publicClient.readContract as jest.Mock;
const cacheGet = cache.get as jest.Mock;
const cacheSet = cache.set as jest.Mock;
const cacheDel = cache.del as jest.Mock;
const ucansVerify = ucans.verify as jest.Mock;

const INVOKER: Hex = "0x56D2000f7cFf923E74388E6185128741cd063A23";
const PORTAL: Hex = "0x1A592FAf20Dd976fcbb5Fc829d504F2bfbE87E3B";
const OLD_DID = "did:key:zOldStaleDid";
const NEW_DID = "did:key:zNewRotatedDid";
const SIGNED_BY_NEW_DID = "ucan-token-signed-by-new-did";
const CACHE_KEY = `collaboratorKeys:${INVOKER}:${PORTAL}`;
const META: ContractMeta[] = [{ contractAddress: PORTAL, version: "v2" }];

// ucans.verify is called by both validateContracts (first attempt) and
// verifyUcanForContract (retry). Both pass `rootIssuer` in the requested
// capabilities; treat verification as ok only when rootIssuer matches the
// DID the token was signed with.
const verifierFor = (signerDid: string) => (_token: string, opts: any) => {
  const rootIssuer = opts.requiredCapabilities[0].rootIssuer;
  return { ok: rootIssuer === signerDid };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateContractAddressV2 — verify-on-mismatch", () => {
  test("stale cache + on-chain rotation: busts cache, refetches, retries, succeeds", async () => {
    cacheGet.mockResolvedValueOnce(OLD_DID); // cache hit on first fetch
    readContract.mockResolvedValueOnce(NEW_DID); // bypass-cache refetch
    ucansVerify.mockImplementation(verifierFor(NEW_DID));

    const result = await validateContractAddressV2(
      META,
      INVOKER,
      SIGNED_BY_NEW_DID
    );

    expect(result.ok).toBe(true);
    expect(result.actualContractAddress).toBe(PORTAL);
    expect(cacheDel).toHaveBeenCalledWith(CACHE_KEY);
    expect(readContract).toHaveBeenCalledTimes(1);
    // After fresh read, fresh DID is written back so future requests skip the chain.
    expect(cacheSet).toHaveBeenCalledWith(
      CACHE_KEY,
      NEW_DID,
      expect.any(Number)
    );
  });

  test("steady-state cache hit: no chain read, no cache bust", async () => {
    cacheGet.mockResolvedValueOnce(NEW_DID);
    ucansVerify.mockImplementation(verifierFor(NEW_DID));

    const result = await validateContractAddressV2(
      META,
      INVOKER,
      SIGNED_BY_NEW_DID
    );

    expect(result.ok).toBe(true);
    expect(readContract).not.toHaveBeenCalled();
    expect(cacheDel).not.toHaveBeenCalled();
  });

  test("no actual rotation: cached DID still matches chain, verification still fails", async () => {
    cacheGet.mockResolvedValueOnce(OLD_DID); // cache hit
    readContract.mockResolvedValueOnce(OLD_DID); // chain agrees — no rotation happened
    ucansVerify.mockImplementation(verifierFor("did:key:zSomeOtherDid"));

    const result = await validateContractAddressV2(
      META,
      INVOKER,
      "ucan-token-with-mismatched-issuer"
    );

    expect(result.ok).toBe(false);
    expect(cacheDel).toHaveBeenCalledWith(CACHE_KEY);
    expect(readContract).toHaveBeenCalledTimes(1);
    // Same DID after refetch → verifyUcanForContract is NOT called a second time.
    // The first attempt's verify call already produced a definitive failure.
    expect(ucansVerify).toHaveBeenCalledTimes(1);
  });
});
