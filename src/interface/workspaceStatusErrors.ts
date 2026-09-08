import { Response } from "express";
import {
  InvalidPortalAddressError,
  WorkspaceLookupUnavailableError,
} from "../domain/workspace";
import { throwError } from "../infra/errorHandler";
import { CustomRequest } from "../types";

const RETRY_AFTER_SECONDS = "5";

// Maps resolveWorkspaceStatus failures to HTTP. Anything else is rethrown.
export function throwForWorkspaceLookupError(
  err: unknown,
  req: CustomRequest,
  res: Response,
  contractAddress: string
): never {
  if (err instanceof InvalidPortalAddressError) {
    return throwError({
      code: 400,
      message: `invalid contract address: ${contractAddress}`,
      req,
    });
  }
  if (err instanceof WorkspaceLookupUnavailableError) {
    // Retryable: the client keeps its payload and tries again.
    res.set("Retry-After", RETRY_AFTER_SECONDS);
    return throwError({
      code: 503,
      message: `workspace status unavailable for contract ${contractAddress}: ${err.message}`,
      req,
    });
  }
  throw err;
}
