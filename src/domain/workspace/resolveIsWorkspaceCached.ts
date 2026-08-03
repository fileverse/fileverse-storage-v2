import { config } from "../../config";
import { getCache, setCache } from "../../infra/cache";
import { checkIsWorkspace } from "./checkIsWorkspace";

// Cached workspace-status lookup (same key/TTL as the isWorkspace and
// canPrivateUpload middlewares). Throws when the identity-indexer lookup
// fails — callers that pick a storage lane must not guess on error.
export async function resolveIsWorkspaceCached(
  contractAddress: string
): Promise<boolean> {
  const cacheKey = `workspace:${contractAddress.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached != null) return cached === "true";

  const isWorkspace = await checkIsWorkspace(contractAddress);
  await setCache(
    cacheKey,
    String(isWorkspace),
    Number(config.WORKSPACE_STATUS_TTL)
  );
  return isWorkspace;
}
