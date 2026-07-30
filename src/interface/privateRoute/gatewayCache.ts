import { getCache, setCache } from "../../infra/cache";
import { redis } from "../../infra/redis";
import { getPrivateFile } from "../../domain/ipfs";
import { config } from "../../config";

const PRIVATE_GATEWAY_CACHE_TTL = config.PRIVATE_GATEWAY_CACHE_TTL?Number(config.PRIVATE_GATEWAY_CACHE_TTL):3600;
// Doc parts are small; don't let large files (e.g. images) balloon Redis.
const PRIVATE_GATEWAY_CACHE_MAX_BYTES = config.PRIVATE_GATEWAY_CACHE_MAX_BYTES
  ? Number(config.PRIVATE_GATEWAY_CACHE_MAX_BYTES)
  : 5 * 1024 * 1024;

export type PrivateGatewayResponse = Awaited<ReturnType<typeof getPrivateFile>>;

type CachedPrivateGatewayResponse =
  | {
      kind: "string";
      data: string;
      contentType?: string | null;
    }
  | {
      kind: "json";
      data: string;
      contentType?: string | null;
    }
  | {
      kind: "blob";
      data: string;
      contentType?: string | null;
    };

const cacheKey = (cid: string) => `private-gateway:${cid}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== "undefined" && value instanceof Blob;

const serializeResponse = async (
  response: PrivateGatewayResponse
): Promise<CachedPrivateGatewayResponse | null> => {
  if (response.data == null) {
    return null;
  }

  try {
    if (typeof response.data === "string") {
      if (Buffer.byteLength(response.data) > PRIVATE_GATEWAY_CACHE_MAX_BYTES) {
        return null;
      }
      return {
        kind: "string",
        data: response.data,
        contentType: response.contentType ?? null,
      };
    }

    if (isBlob(response.data)) {
      if (response.data.size > PRIVATE_GATEWAY_CACHE_MAX_BYTES) {
        return null;
      }
      const buffer = Buffer.from(await response.data.arrayBuffer());

      return {
        kind: "blob",
        data: buffer.toString("base64"),
        contentType: response.contentType ?? null,
      };
    }

    const data = JSON.stringify(response.data);

    if (data == null || Buffer.byteLength(data) > PRIVATE_GATEWAY_CACHE_MAX_BYTES) {
      return null;
    }

    return {
      kind: "json",
      data,
      contentType: response.contentType ?? null,
    };
  } catch {
    return null;
  }
};

const parseCachedResponse = (
  value: string
): CachedPrivateGatewayResponse | null => {
  try {
    const parsed: unknown = JSON.parse(value);

    if (!isRecord(parsed)) {
      return null;
    }

    const contentType: string | null =
      typeof parsed.contentType === "string" || parsed.contentType === null
        ? parsed.contentType
        : null;

    if (parsed.kind === "string" && typeof parsed.data === "string") {
      return {
        kind: "string",
        data: parsed.data,
        contentType,
      };
    }

    if (parsed.kind === "json" && typeof parsed.data === "string") {
      return {
        kind: "json",
        data: parsed.data,
        contentType,
      };
    }

    if (parsed.kind === "blob" && typeof parsed.data === "string") {
      return {
        kind: "blob",
        data: parsed.data,
        contentType,
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const getCachedPrivateGatewayResponse = async (
  cid: string
): Promise<PrivateGatewayResponse | null> => {
  if (!redis) {
    return null;
  }

  try {
    const cached = await getCache(cacheKey(cid));

    if (cached == null) {
      return null;
    }

    const parsed = parseCachedResponse(cached);

    if (!parsed) {
      return null;
    }

    const contentType: string | null = parsed.contentType ?? null;

    if (parsed.kind === "string") {
      return {
        data: parsed.data,
        contentType,
      };
    }

    if (parsed.kind === "json") {
      return {
        data: JSON.parse(parsed.data),
        contentType,
      };
    }

    return {
      data: new Blob([Buffer.from(parsed.data, "base64")], {
        type: contentType ?? undefined,
      }),
      contentType,
    };
  } catch {
    return null;
  }
};

export const setCachedPrivateGatewayResponse = async (
  cid: string,
  response: PrivateGatewayResponse
): Promise<void> => {
  if (!redis) {
    return;
  }

  const cached = await serializeResponse(response);

  if (!cached) {
    return;
  }

  try {
    await setCache(cacheKey(cid), JSON.stringify(cached), PRIVATE_GATEWAY_CACHE_TTL);
  } catch {
    return;
  }
};