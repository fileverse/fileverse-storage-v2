import { isAddress } from "viem";
import { config } from "../../config";
import { getCache, setCache } from "../../infra/cache";
import { Workspace } from "../../infra/database/models";
import { checkIsWorkspace } from "./checkIsWorkspace";
import { InvalidPortalAddressError } from "./errors";

const CACHE_TTL = Number(config.WORKSPACE_STATUS_TTL);
const CACHE_OP_TIMEOUT_MS = 200;
const DUPLICATE_KEY = 11000;

const cacheKey = (portal: string) => `workspace:${portal}`;

// Redis is an accelerator only. The ioredis client queues commands while
// disconnected, so a slow or dead Redis must read as a miss, never as a wait.
async function cacheGet(key: string): Promise<string | null | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      getCache(key),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CACHE_OP_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function cacheSet(key: string, value: string): void {
  setCache(key, value, CACHE_TTL).catch(() => undefined);
}

async function persistConfirmed(portal: string): Promise<void> {
  try {
    await Workspace.updateOne(
      { _id: portal },
      { $set: { isWorkspace: true, confirmedAt: new Date() } },
      { upsert: true }
    );
  } catch (err) {
    // Two first uploads racing the upsert can collide on _id; the row exists
    // either way.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
  }
}

// Tiers: Redis → Mongo (durable) → identity indexer. Only positive answers are
// persisted: a portal never changes type after mint, but a negative can be
// stale while a fresh workspace is still registering. Throws
// WorkspaceLookupUnavailableError when the indexer is needed and does not
// answer: callers must not guess a lane.
export async function resolveWorkspaceStatus(
  contractAddress: string
): Promise<boolean> {
  if (!isAddress(contractAddress, { strict: false })) {
    throw new InvalidPortalAddressError(contractAddress);
  }
  const portal = contractAddress.toLowerCase();
  const key = cacheKey(portal);

  if ((await cacheGet(key)) === "true") return true;

  const durable = await Workspace.findById(portal).lean();
  if (durable) {
    if (durable.isWorkspace) cacheSet(key, "true");
    return durable.isWorkspace;
  }

  const isWorkspace = await checkIsWorkspace(portal);
  if (isWorkspace) {
    await persistConfirmed(portal);
    cacheSet(key, "true");
  }
  return isWorkspace;
}
