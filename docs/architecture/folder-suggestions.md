# Folder suggestions

Storage for folder suggestions on team-workspace folders. People holding a folder link upload a
file for the folder owner to accept or decline. The bytes are encrypted in the browser before
upload, so storage-v2 never sees plaintext, file names or types.

apps-coordinator owns the suggestion records. storage-v2 holds the ciphertext, ties each upload
to a folder link when the coordinator claims it, and cleans up uploads nobody claimed.

## Routes

| Route | Auth | Body | Responses |
| --- | --- | --- | --- |
| `POST /upload/suggestion` | none | multipart `file`, at most `10 MiB + 1 KiB` | 200 `{ cid, size }`; 400 `NO_FILE`; 413 over the cap; 502 upload failed |
| `POST /internal/suggestions/claim` | `x-internal-api-key` | `{ cid, portal, linkId }` | 200 `{ size }`; 403 `PORTAL_LOCKED`; 404 `UPLOAD_NOT_FOUND`; 409 `ALREADY_CLAIMED` |
| `POST /internal/suggestions/release` | `x-internal-api-key` | `{ cid }` | 200 `{}` |

The upload route always uses the private lane. It is open, like `/upload/image`, because visitors
are logged out and must not learn the folder's portal. The size cap bounds what an anonymous
caller can push; there is no IP-based throttling.

A claim by the same `linkId` that already holds the row succeeds again, so a coordinator retry
after a lost response is safe. A claim by a different link answers `ALREADY_CLAIMED`.

The owner downloads a pending suggestion through the existing `GET /private/gateway?cid=`.

## Row shape

Each upload is one `files` row:

- `ipfsType: "SUGGESTION"`, `tags: ["suggestion"]`, `isPinned: true`
- `suggestion: { claimed, portal, linkId, claimedAt }`; `portal` and `linkId` are set on claim
- no `contractAddress` and no `appFileId`

Without a `contractAddress`, no quota or doc-usage code counts a pending suggestion. When the
owner accepts one, their client uploads the file again through the normal upload path, and that
copy counts against the portal.

There is at most one live suggestion row per CID, even when two identical uploads land at once (a
partial unique index, see Ops). That matters because unpinning any row deletes the pin every row
with that CID shares. Once a row is released, a later upload of the same ciphertext gets a new row
while the old one waits for the unpin job, and that job can then delete the shared pin. Clients
never re-send a ciphertext: every attempt is encrypted afresh, so this does not arise in practice.

## Lifecycle

1. Upload: a row is created with `suggestion.claimed: false`.
2. Claim: apps-coordinator registers the suggestion and claims the row for its folder link.
3. Release: on accept or decline, apps-coordinator releases the CID. The row gets
   `isDeleted: true` and `markedForUnpin: true`.
4. Unpin: the existing `UNPIN_DELETED_FILE_HASH_CRON` deletes the pin.

Uploads that are still unclaimed one hour after upload are marked the same way by
`SWEEP_UNCLAIMED_SUGGESTIONS_CRON`, which runs every 15 minutes in the
`unpin-deleted-file-cron` process.

## Plan lock

A claim answers 403 `PORTAL_LOCKED` when the portal's plan has ended (`Limit.locked`). Pending
suggestions do not count toward the portal's storage, so the lock is only checked at claim time.

## Ops

- `INTERNAL_API_KEY` must be set. apps-coordinator sends the same value as
  `STORAGE_INTERNAL_API_KEY`.
- Indexes on `files` are created by hand (`autoIndex` is off). Two are needed:
  - for the sweep: `{ ipfsType: 1, "suggestion.claimed": 1, isDeleted: 1, timeStamp: 1 }`;
  - one live row per CID (declared on the schema):
    `{ ipfsHash: 1, ipfsType: 1 }` with `unique: true` and
    `partialFilterExpression: { ipfsType: "SUGGESTION", isDeleted: false }`.
    Without it, uploads still work, but two identical uploads landing at once can leave two rows.
