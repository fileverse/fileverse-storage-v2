# Storage usage debug view

Date: 2026-09-19
Repos: fileverse-storage-v2 (branch `nk/storage-usage-per-doc`, one read-only route) and ddocs.new (one unlinked page)
Purpose: make the per-document accounting from the storage-usage redesign visible while testing it, without touching the product UI.

## 1. Goal

Show, for every portal in the signed-in user's keystore, what the accounting rows say each document costs, what the files collection says right now, and whether the portal total agrees with its rows. Refresh on demand or every five seconds so a publish or delete in another tab can be watched landing.

Testing-only. No product surface changes. Nothing on either side writes.

## 2. Server: `GET /limit/usage-by-doc`

Registered next to `GET /limit/use` in `src/interface/limit/index.ts`, behind the same `canCheckLimitUse` middleware, so the same owner token, `contract`, `invoker` and `chain` headers work. Unlike `/use`, only the single portal the token verified for is served (`req.contractAddress`), never the rest of a comma-joined list: the auth layer accepts a list as soon as one entry verifies, which is fine for totals but would let a portal owner read other portals' document ids and sizes. The page calls once per portal with that portal's own token.

Query: `live=1` also recomputes each document from `files` with the rebuild's aggregation (`computePortalDocUsages`), so the response carries stored and live numbers side by side. Without it only the stored rows are read.

Response:

```json
{
  "portals": [
    {
      "contractAddress": "0x…",
      "legacy": false,
      "cutoff": 5,
      "storageUse": 123456,
      "rowSum": 123456,
      "liveSum": 123456,
      "usageDirty": false,
      "dirtyRows": 0,
      "unsummedRows": 0,
      "truncated": false,
      "docs": [
        {
          "appFileId": "…",
          "stored": {
            "charge": 1000,
            "countedVersions": 3,
            "latestFileSize": 400,
            "latestTimeStamp": 1758240000000,
            "dirty": false,
            "summed": true,
            "attempts": 0,
            "lastError": null,
            "updatedAt": 1758240001000
          },
          "live": {
            "charge": 1000,
            "countedVersions": 3,
            "latestFileSize": 400,
            "latestTimeStamp": 1758240000000
          }
        }
      ]
    }
  ]
}
```

- `storageUse` is `limits.storageUse`; `rowSum` is the sum of `charge` over the portal's `doc-usages` rows (all rows, not only the returned page); `liveSum` is the sum of live charges, `null` without `live=1`. `storageUse === rowSum` is the invariant the worker maintains.
- `docs` holds the union of stored rows and live documents, sorted by the larger of the two charges, capped at 500 entries; `truncated` says whether the cap cut anything. `stored` is `null` for a document the files collection has but no row exists for yet; `live` is `null` for a row whose document has no live content (a tombstone), or always without `live=1`.
- `dirtyRows` and `unsummedRows` are counts over all rows of the portal.
- A legacy portal (per `isLegacyContract`) returns `legacy: true` with zeroed numbers and no docs; the redesign does not account those.

Domain function `getUsageByDoc({ contractAddress, live })` in `src/domain/limit/getUsageByDoc.ts`, exported from the barrel. The row-sum helper in `docUsage.ts` is exported as `sumDocCharges` and reused; nothing new is written to the database.

## 3. Client: `/dev/storage` page in ddocs.new

`app/dev/storage/page.tsx`, same pattern as `app/dev/pq-wizard/page.tsx`: an unlinked route that lives on the branch and is reached through its Vercel preview URL.

Gate: a constant at the top of the file, `const STORAGE_DEBUG_PAGE = true;`. When `false` the page calls `notFound()`. It is flipped by hand; if the page ever moves to staging the constant becomes an env read.

Data: a `storageUsageByDocAPI` next to `storageUsageAPI` in `utils/get-storage.ts`, sending the same headers and `live=1`. The page derives the portal list, the primary portal, the owner secret and the agent address exactly as `hooks/use-portal-storage.tsx` does, and fetches with React Query. A "Live refresh" toggle sets `refetchInterval` to 5 seconds; a "Refresh" button refetches once.

Titles: `db.ddocs.bulkGet(appFileIds)` from the local Dexie store; an id with no local record shows the id shortened.

Layout: one card per portal with the header numbers (`storageUse`, `rowSum`, `liveSum`, the difference highlighted when non-zero, `usageDirty`, dirty and unsummed counts, cutoff, truncated), then a table: title, short id, stored charge, live charge, delta, versions counted (stored / live), latest size, badges for dirty, unsummed, attempts > 0 with the last error on hover, and `updatedAt` as a relative time. Sizes in bytes with a MB rendering beside them. Plain Tailwind and `@fileverse/ui` primitives already used in the app; no new dependencies.

States: not signed in (identity status not `ready`) shows one line; loading and error show one line each; a legacy portal card says so.

## 4. Out of scope

- Any link to the page from the product UI.
- Editing, re-marking, or triggering a rebuild from the page.
- dSheet titles (only ddocs live in `db.ddocs`; dSheet ids show shortened).
- Anything for viewers or collaborators; the page only shows portals the user owns a keystore slice for.

## 5. Testing use

Publish six times to one document and watch the row go dirty, then clean with `countedVersions` 5 and `charge` equal to the newest five sizes; delete a document and watch the row's live side go `null` with charge 0; run the rebuild script and confirm `rowSum` and `storageUse` converge; force a compute failure and watch `attempts` climb and `usageDirty` flip.
