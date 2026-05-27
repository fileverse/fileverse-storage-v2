jest.mock("../domain/contract");
jest.mock("./ucanUtils");
jest.mock("./cache", () => ({ cache: { del: jest.fn() } }));

import { Hex } from "viem";
import {
  getCollaboratorKeys,
  getLegacyCollaboratorKeys,
  isLegacyContract,
} from "../domain/contract";
import {
  validateContracts,
  extractClaimedRootIssuer,
} from "./ucanUtils";
import { cache } from "./cache";
import { validateContractAddress } from "./ucan";

const asMock = <T>(fn: T) => fn as unknown as jest.Mock;

const INVOKER: Hex = "0x56D2000f7cFf923E74388E6185128741cd063A23";
const PORTAL_A: Hex = "0x1A592FAf20Dd976fcbb5Fc829d504F2bfbE87E3B";
const PORTAL_B: Hex = "0xBbB5fc829D504F2BFbE87e3B1A592fAF20DD976F";
const OLD_DID = "did:key:zOld";
const NEW_DID = "did:key:zNew";
const OTHER_DID = "did:key:zOther";
const TOKEN = "ucan-token";
const cacheKey = (portal: Hex) => `collaboratorKeys:${INVOKER}:${portal}`;

type PortalState = {
  isLegacy?: boolean;
  cachedDid?: string | null;
  freshDid?: string | null;
  // For non-legacy contracts whose invoker DID lives in the legacy storage
  // (the fallback branch in validateContractAddress).
  legacyFallbackCached?: string | null;
  legacyFallbackFresh?: string | null;
};

function setupChain(portals: Partial<Record<Hex, PortalState>>) {
  asMock(isLegacyContract).mockImplementation(async (p: Hex) =>
    Boolean(portals[p]?.isLegacy)
  );

  asMock(getCollaboratorKeys).mockImplementation(
    async (_invoker: Hex, portal: Hex, opts?: { bypassCache?: boolean }) => {
      const s = portals[portal];
      if (!s) return null;
      return opts?.bypassCache ? s.freshDid ?? null : s.cachedDid ?? null;
    }
  );

  asMock(getLegacyCollaboratorKeys).mockImplementation(
    async (_invoker: Hex, portal: Hex, opts?: { bypassCache?: boolean }) => {
      const s = portals[portal];
      if (!s) return null;
      if (s.isLegacy) {
        return opts?.bypassCache ? s.freshDid ?? null : s.cachedDid ?? null;
      }
      return opts?.bypassCache
        ? s.legacyFallbackFresh ?? null
        : s.legacyFallbackCached ?? null;
    }
  );
}

function setupToken(claimedIssuer: string | null) {
  asMock(extractClaimedRootIssuer).mockReturnValue(claimedIssuer);
}

function setupVerify(...results: Array<{ ok: boolean; portal?: Hex }>) {
  const mock = asMock(validateContracts);
  mock.mockReset();
  for (const r of results) {
    mock.mockResolvedValueOnce({
      ok: r.ok,
      actualContractAddress: r.ok ? r.portal ?? null : null,
    });
  }
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateContractAddress", () => {
  it("steady state: cached DID matches claimed issuer, no refetch", async () => {
    setupChain({ [PORTAL_A]: { cachedDid: NEW_DID } });
    setupToken(NEW_DID);
    setupVerify({ ok: true, portal: PORTAL_A });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_A });
    expect(validateContracts).toHaveBeenCalledTimes(1);
    expect(cache.del).not.toHaveBeenCalled();
    expect(getCollaboratorKeys).toHaveBeenCalledTimes(1);
    expect(getCollaboratorKeys).toHaveBeenCalledWith(INVOKER, PORTAL_A);
  });

  it("rotation: stale cache + issuer mismatch → cache bust, refetch, retry succeeds", async () => {
    setupChain({
      [PORTAL_A]: { cachedDid: OLD_DID, freshDid: NEW_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false }, { ok: true, portal: PORTAL_A });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_A });
    expect(validateContracts).toHaveBeenCalledTimes(2);
    expect(validateContracts).toHaveBeenLastCalledWith(
      [{ contractAddress: PORTAL_A, invokerDid: NEW_DID }],
      TOKEN
    );
    expect(cache.del).toHaveBeenCalledWith(cacheKey(PORTAL_A));
    expect(getCollaboratorKeys).toHaveBeenCalledWith(INVOKER, PORTAL_A, {
      bypassCache: true,
    });
  });

  it("genuinely invalid token: claimed issuer matches cache → no refetch", async () => {
    setupChain({
      [PORTAL_A]: { cachedDid: OLD_DID, freshDid: NEW_DID },
    });
    setupToken(OLD_DID);
    setupVerify({ ok: false });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: false, actualContractAddress: null });
    expect(validateContracts).toHaveBeenCalledTimes(1);
    expect(cache.del).not.toHaveBeenCalled();
    expect(getCollaboratorKeys).toHaveBeenCalledTimes(1);
  });

  it("unparseable token: no claimed issuer → return original failure", async () => {
    setupChain({ [PORTAL_A]: { cachedDid: OLD_DID } });
    setupToken(null);
    setupVerify({ ok: false });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: false, actualContractAddress: null });
    expect(validateContracts).toHaveBeenCalledTimes(1);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it("no actual rotation: refetch returns same cached DID → no retry verify", async () => {
    // Token claims a new DID, but on-chain still has the old one (e.g. client
    // sent a token signed by a stranger key). Cache gets busted defensively,
    // but we don't waste a second verify call.
    setupChain({
      [PORTAL_A]: { cachedDid: OLD_DID, freshDid: OLD_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: false, actualContractAddress: null });
    expect(validateContracts).toHaveBeenCalledTimes(1);
    expect(cache.del).toHaveBeenCalledWith(cacheKey(PORTAL_A));
  });

  it("legacy contract: rotation recovery uses only the legacy fetcher", async () => {
    setupChain({
      [PORTAL_A]: { isLegacy: true, cachedDid: OLD_DID, freshDid: NEW_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false }, { ok: true, portal: PORTAL_A });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_A });
    expect(getCollaboratorKeys).not.toHaveBeenCalled();
    expect(getLegacyCollaboratorKeys).toHaveBeenCalledTimes(2);
    expect(getLegacyCollaboratorKeys).toHaveBeenLastCalledWith(
      INVOKER,
      PORTAL_A,
      { bypassCache: true }
    );
  });

  it("non-legacy contract resolved via legacy fallback: refetch uses legacy only", async () => {
    // Non-legacy contract, but the invoker's DID happens to live in legacy
    // storage. The original lookup tried current (null), fell back to legacy.
    // Refetch mirrors the fetcher that produced the cached value — legacy
    // only — to avoid burning an extra RPC on a path we already know is empty.
    setupChain({
      [PORTAL_A]: {
        cachedDid: null,
        freshDid: null,
        legacyFallbackCached: OLD_DID,
        legacyFallbackFresh: NEW_DID,
      },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false }, { ok: true, portal: PORTAL_A });

    const result = await validateContractAddress([PORTAL_A], INVOKER, TOKEN);

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_A });
    // Current called once initially (returned null → fallback to legacy); not
    // called again on retry because fetcher was tracked as "legacy".
    expect(getCollaboratorKeys).toHaveBeenCalledTimes(1);
    expect(getCollaboratorKeys).not.toHaveBeenCalledWith(INVOKER, PORTAL_A, {
      bypassCache: true,
    });
    expect(getLegacyCollaboratorKeys).toHaveBeenCalledTimes(2);
    expect(getLegacyCollaboratorKeys).toHaveBeenLastCalledWith(
      INVOKER,
      PORTAL_A,
      { bypassCache: true }
    );
  });

  it("multi-contract, claimed issuer matches a cached DID and every cache slot is known: no refetch", async () => {
    // Token is rooted at PORTAL_A's collaborator DID, but verify failed on
    // PORTAL_B (e.g. capability targets the wrong contract). Both cache slots
    // are populated so we can be confident this isn't a rotation symptom —
    // refetching would just waste RPC.
    setupChain({
      [PORTAL_A]: { cachedDid: NEW_DID },
      [PORTAL_B]: { cachedDid: OTHER_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false });

    const result = await validateContractAddress(
      [PORTAL_A, PORTAL_B],
      INVOKER,
      TOKEN
    );

    expect(result).toEqual({ ok: false, actualContractAddress: null });
    expect(validateContracts).toHaveBeenCalledTimes(1);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it("multi-contract, newly added on a second portal (null cache slot): refetches the null slot and succeeds", async () => {
    // Invoker is a known collaborator on PORTAL_A (cached). They were just
    // added on PORTAL_B on-chain; the cache has never been populated for B.
    // The claimed issuer matches A's cached DID — but B's null slot is "we
    // haven't looked yet", so the short-circuit must NOT trigger.
    setupChain({
      [PORTAL_A]: { cachedDid: NEW_DID, freshDid: NEW_DID },
      [PORTAL_B]: { cachedDid: null, freshDid: NEW_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false }, { ok: true, portal: PORTAL_B });

    const result = await validateContractAddress(
      [PORTAL_A, PORTAL_B],
      INVOKER,
      TOKEN
    );

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_B });
    expect(cache.del).toHaveBeenCalledWith(cacheKey(PORTAL_B));
    expect(validateContracts).toHaveBeenLastCalledWith(
      [
        { contractAddress: PORTAL_A, invokerDid: NEW_DID },
        { contractAddress: PORTAL_B, invokerDid: NEW_DID },
      ],
      TOKEN
    );
  });

  it("multi-contract rotation: all contracts mismatch claim → all refetched, retry succeeds", async () => {
    // Invoker rotated their key. The same new DID is now on-chain for both
    // portals where they're a collaborator. Claimed issuer matches no cached
    // DID, so we refetch every mismatching entry and retry.
    setupChain({
      [PORTAL_A]: { cachedDid: OLD_DID, freshDid: NEW_DID },
      [PORTAL_B]: { cachedDid: OTHER_DID, freshDid: NEW_DID },
    });
    setupToken(NEW_DID);
    setupVerify({ ok: false }, { ok: true, portal: PORTAL_A });

    const result = await validateContractAddress(
      [PORTAL_A, PORTAL_B],
      INVOKER,
      TOKEN
    );

    expect(result).toEqual({ ok: true, actualContractAddress: PORTAL_A });
    expect(cache.del).toHaveBeenCalledWith(cacheKey(PORTAL_A));
    expect(cache.del).toHaveBeenCalledWith(cacheKey(PORTAL_B));
    expect(validateContracts).toHaveBeenLastCalledWith(
      [
        { contractAddress: PORTAL_A, invokerDid: NEW_DID },
        { contractAddress: PORTAL_B, invokerDid: NEW_DID },
      ],
      TOKEN
    );
  });
});
