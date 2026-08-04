import { config } from "../../config";
import { getCache, setCache } from "../../infra/cache";
import { checkIsWorkspace } from "./checkIsWorkspace";

// Cached workspace-status lookup (same key/TTL as the canPrivateUpload
// middleware). Positive answers only: a "no" during identity-indexer lag
// (fresh workspace not yet indexed) must never be memorized, or uploads ride
// the public lane until the entry expires. Throws when the identity-indexer
// lookup fails — callers that pick a storage lane must not guess on error.
export async function resolveIsWorkspaceCached(
  contractAddress: string
): Promise<boolean> {
  const cacheKey = `workspace:${contractAddress.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached === "true") return true;

  const isWorkspace = await checkIsWorkspace(contractAddress);
  if (isWorkspace) {
    await setCache(cacheKey, "true", Number(config.WORKSPACE_STATUS_TTL));
  }
  return isWorkspace;
}
