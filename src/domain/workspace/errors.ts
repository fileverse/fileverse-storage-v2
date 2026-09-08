// The identity indexer did not give an answer (timeout, network error, non-2xx).
// Callers must not pick a lane on this; it maps to a retryable 503.
export class WorkspaceLookupUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceLookupUnavailableError";
  }
}

export class InvalidPortalAddressError extends Error {
  constructor(public readonly address: string) {
    super(`invalid portal address: ${address}`);
    this.name = "InvalidPortalAddressError";
  }
}
