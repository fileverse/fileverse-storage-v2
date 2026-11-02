// The client caps plaintext at 10 MiB; the margin covers the AES-GCM IV and tag.
export const SUGGESTION_UPLOAD_MAX_BYTES = 10 * 1024 * 1024 + 1024;
export const UNCLAIMED_SUGGESTION_TTL_MS = 60 * 60 * 1000;
