import { config } from "../../config";
import { WorkspaceLookupUnavailableError } from "./errors";

const TIMEOUT_MS = Number(config.IDENTITY_INDEXER_TIMEOUT_MS);
const ATTEMPTS = 2;

const describe = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

// One retry, and only when the indexer did not answer at all. A 5xx is an
// answer from a struggling service: retrying it doubles its load and holds
// the upload for another timeout.
export async function checkIsWorkspace(
  contractAddress: string
): Promise<boolean> {
  const url = `${config.IDENTITY_INDEXER_URL}/keystores/is-workspace?contractAddress=${encodeURIComponent(contractAddress)}`;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      if (attempt === ATTEMPTS) {
        throw new WorkspaceLookupUnavailableError(
          `identity indexer unreachable for ${contractAddress}: ${describe(err)}`
        );
      }
      continue;
    }
    if (!response.ok) {
      throw new WorkspaceLookupUnavailableError(
        `identity indexer returned ${response.status} for ${contractAddress}`
      );
    }
    const data = await response.json();
    return Boolean(data.isWorkspace);
  }

  throw new WorkspaceLookupUnavailableError(
    `identity indexer unreachable for ${contractAddress}`
  );
}
