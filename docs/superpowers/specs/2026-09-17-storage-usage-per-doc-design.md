# Storage usage: per-document accounting with a version cutoff

Date: 2026-09-17, revised 2026-09-18 after the in-depth review
Status: v2 design, agreed item by item with Nadeem
Repo: fileverse-storage-v2, branch `nk/storage-usage-per-doc` from `main` (server-side plus one new worker process; no client or indexer changes)

## 1. Problem

`limits.storageUse` is a running counter. Every content upload adds the file's pinned
size, and only the indexer's file-deleted webhook ever subtracts. Each publish of a
document creates a new content file, so a 2 MB document edited ten times is billed
20 MB. Users are charged for the full history of every edit, and the counter drifts
because the direct delete route never decrements and nothing reconciles it against the
file rows.

## 2. Goal for v1

Change only how storage used is computed. A document is billed for at most a fixed
number of its newest versions, at their actual sizes. Enforcement, the limit
endpoints, the client, top-ups, and pinning behaviour are unchanged. Unpinning
versions beyond the cutoff is a later product decision and is out of scope.

## 3. Definition

For a portal `P` and a document `D` (an `appFileId`):

- `rows(D)` = file rows with `contractAddress = P`, `appFileId = D`,
  `ipfsType = CONTENT`, `isDeleted = false`
- `n` = count of `rows(D)`
- `c` = the portal's effective version cutoff: `limits.versionCutoff` when set,
  otherwise config `STORAGE_VERSION_CUTOFF`, default 5
- `newest(D)` = the `min(c, n)` rows of `rows(D)` with the highest `timeStamp`,
  ties broken by `_id` descending
- `charge(D)` = sum of `fileSize` over `newest(D)`, a missing `fileSize` counting as 0
- `storageUse(P)` = sum of `charge(D)` over every `D` with `n ≥ 1`

Only rows that carry a non-empty `appFileId` are billed. A content row without one
is not counted at all. New content uploads are required to carry an `appFileId`
(4.6), so this only affects legacy rows, whose count the rebuild script reports.

Only content rows are billed, exactly as today. Gate, metadata, comment, and image
bytes are not counted. Folder manifests are uploaded as content (their file name
ends in `-FOLDER-CONTENT`) and are billed like any document, keyed by the folder id.
Every content upload counts as a version, including permission-only and key-rotation
republishes. Rows from the public and private lanes and from both source apps are
treated identically.

Why the sum of actual sizes rather than latest size times count: documents grow, so
"latest × count" re-prices small early versions at the current size and can bill a
five-version document at several times what it ever stored. The sum of the newest
`c` sizes is exactly the bytes that will remain pinned once versions past the cutoff
are unpinned.

## 4. Design

### 4.0 New fields on `limits`

- `versionCutoff`: nullable positive integer. Unset means the config default applies.
  This is the seam for paid plans: a plan sets this field (and `storageLimit`) on the
  portal's row, and nothing else in the accounting knows plans exist.
- `usageDirty`: boolean, default false. Set when a document's refresh has failed
  repeatedly (4.5); cleared by the rebuild script's `--dirty` mode.

### 4.1 New collection: `doc-usages`

One row per document that has had live content since the migration. Model
`DocUsage` in `src/infra/database/models/doc-usage.ts`.

| Field | Type | Meaning |
|---|---|---|
| contractAddress | string, lowercase, required | portal |
| appFileId | string, required | document |
| latestFileSize | number | `fileSize` of the newest live row, 0 when none |
| countedVersions | number | `min(c, n)`; 0 when the document has no live content |
| latestTimeStamp | number | `timeStamp` of the newest live row, 0 when none |
| charge | number | `charge(D)`; 0 when the document has no live content |
| cutoff | number | the `c` used when this row was last computed |
| updatedAt | number, epoch ms | last time the computed fields were written |
| dirty | boolean | a content write or delete happened and the row must be recomputed |
| dirtyAt | number or null | epoch ms of the last dirty mark |
| summed | boolean | false from the row write until the portal total has been re-summed with it |
| attempts | number | consecutive failed recomputes since the last dirty mark |
| lastError | string or null | message of the last failed recompute |

Indexes: unique `{ contractAddress: 1, appFileId: 1 }`; partial
`{ dirty: 1, dirtyAt: 1 }` with `partialFilterExpression: { dirty: true }` for the
worker's poll; partial `{ summed: 1, contractAddress: 1 }` with
`partialFilterExpression: { summed: false }` for the worker's portal pass.

The model is typed (`IDocUsage`, `model<IDocUsage>`) so the rebuild's bulk write
checks against the real nullable field types.

A document whose live content is all deleted keeps a zero-charge row (a tombstone)
until the next rebuild of its portal sweeps it. Keeping the row, rather than deleting
it, is what lets the rebuild tell "the live path already handled this document
during my run" from "this document is dead".

### 4.2 New index on `files`

`{ contractAddress: 1, appFileId: 1, ipfsType: 1, isDeleted: 1, timeStamp: -1, _id: -1 }`,
declared on the file schema. The per-document query matches on the first four fields
and sorts on the last two, so it walks at most `c` index entries per call without an
in-memory sort.

Index builds run through mongoose's default `autoIndex` on the next boot. Builds do
not block reads or writes. The models module attaches a handler that logs a failed
build at error level; nothing waits for the build.

### 4.3 The hot path: mark, do not compute

The request path never computes a charge and never touches `storageUse`. Each site
that mutates content rows marks the affected documents dirty:

**`markUsageDirty({ contractAddress, appFileIds })`** upserts the `doc-usages` row
for each id with `dirty: true`, `dirtyAt: now`, `attempts: 0`, inserting a zero
row (`summed: true`, nothing to add yet) if none exists. It does not change `updatedAt`. A duplicate-key error from two
concurrent inserts of the same row is retried once. `markUsageDirtyQuietly` wraps
it, logs a failure with portal and ids, and never throws.

| Site | After |
|---|---|
| `domain/file/create.ts` | when `ipfsType === CONTENT` and `appFileId` is non-empty, mark that id |
| `domain/file/deleteByIpfsHashes.ts` | match rows by hash and portal including already-deleted ones, tombstone the live ones, mark every distinct `appFileId` among matched content rows; return `{ deletedCount, bytesFreed: 0 }` |
| `domain/file/deleteAll.ts` | tombstone, then always mark the criteria's `appFileId`, even when nothing was newly tombstoned |

Matching already-deleted rows in the two delete sites is what makes a retry heal: a
second delete of the same document, or a webhook redelivery, marks the document
dirty again even though it has nothing left to tombstone.

`bytesFreed` is always 0. The indexer only logs it.

### 4.4 The worker: compute rows, then re-sum portals

A new agenda job, `REFRESH_DOC_USAGE`, runs every 5 seconds in its own process
(`usage-refresh-cron`, alongside the existing unpin and user-op crons in the
Procfile), defined with `concurrency: 1` and `lockLimit: 1`. Each tick has two
passes.

**Row pass.** Take up to 200 dirty rows ordered by `dirtyAt`, and for each:

1. Resolve the portal's cutoff (once per portal per tick).
2. Run the bounded query: `rows(D)` sorted by `timeStamp` desc, `_id` desc,
   `limit(c)`, selecting `fileSize` and `timeStamp`. Compute `charge`,
   `countedVersions`, `latestFileSize`, `latestTimeStamp`.
3. Write the computed fields with `updateOne` filtered on the row's `_id` and the
   `dirtyAt` it read, setting `dirty: false`, `summed: false`, `attempts: 0`,
   `lastError: null`, `updatedAt: now`. If the filter matches nothing, the document
   was re-marked while computing; leave it for the next tick.

**Portal pass.** For every portal that has any `summed: false` row (whether written
by this tick, a previous tick, or a process that died mid-tick):

1. `computeStorageUse(portal)`: read the stored `storageUse`, sum `charge` over the
   portal's rows, replace `storageUse` with the sum only if it still holds the value
   read, then read it back; if either check fails, repeat, up to five passes, then
   throw. The compare-and-set is what keeps a concurrent rebuild and the worker
   from clobbering each other; the read-back is what catches a write that landed
   after ours.
2. Set `summed: true` on the portal's rows with `summed: false` and
   `updatedAt <= the moment the sum started`.

Both writes replace state rather than adjust it, so a crash, a timeout whose write
did land, or a repeated tick can only leave a total stale for one tick, never
wrong. A total is never adjusted by a delta anywhere. The cost per tick is one
bounded read and one row write per dirty document plus one aggregate over
`doc-usages` (indexed by portal) per touched portal.

Clearing `summed` by `updatedAt` is only correct because one process runs the job
and its row pass finishes before its portal pass starts. Run the worker as exactly
one dyno.

### 4.5 Failure handling

Any error while computing a row increments `attempts` and stores `lastError`
through a write guarded on the same `dirtyAt` (a re-mark that landed meanwhile owns
the row and is left alone); the row stays dirty and is retried on a later tick.
After 5 consecutive failures the worker clears `dirty`, sets
`limits.usageDirty = true` for the portal, logs at error level with portal,
`appFileId` and the error, and posts to the Slack error hook through the existing
`reportError`. A later content write to the document marks it dirty again with
`attempts` reset, which restarts the retries.

A failed portal sum leaves its rows `summed: false`, so it is simply retried on the
next tick; the worker logs each failure and posts to Slack once when the same portal
has failed five ticks in a row.

The rebuild script's `--dirty` mode rebuilds every portal with `usageDirty` set and
clears the flag. Its dry-run output also prints the number of dirty portals and the
number of rows currently waiting with `attempts > 0`, so a systematic failure is
visible on the first look.

Nothing on the request path can fail because of accounting: the only accounting
call there is `markUsageDirtyQuietly`.

### 4.6 `appFileId` is required for content

Every upload route (batch and single, public and private) rejects a request with
400 when it carries a `CONTENT` file and no non-empty string `appFileId`. The
batch routes check this in the handler after classifying the files by name, so a
gate-only or metadata-only batch (the client sends those without an `appFileId`)
is unaffected; the single-file routes check `ipfsType`, since they also carry
folder metadata, invites and keystore slices that have no document. This removes
the "content row without an `appFileId`" case for all new uploads.

### 4.7 Rebuild, `src/domain/limit/rebuildPortalUsage.ts`

`rebuildPortalUsage({ contractAddress })` recomputes one portal from `files`:

1. Note `startedAt`. Read `storageUse` (for the report) and the cutoff.
2. One aggregation over the portal's live content rows with a non-empty
   `appFileId`: sort by `timeStamp` desc, `_id` desc; group by `appFileId` pushing
   `fileSize` (missing as 0) and taking the first `timeStamp`; project the first `c`
   sizes, their sum, and their count. Runs with `allowDiskUse`. The per-group array
   holds every version of a document, acceptable for a rebuild and never used on the
   hot path. The `$push` and `$first` order relies on the preceding `$sort`, which
   holds on an unsharded deployment.
3. One `bulkWrite` of upserts, each filtered on the document key **and**
   `updatedAt < startedAt`, setting the computed fields, `updatedAt: now` and
   `summed: false`, and never touching `dirty`, `dirtyAt` or `attempts`. A row the worker wrote during
   the run is newer than `startedAt`, so its upsert fails with a duplicate key and is
   skipped: whoever wrote last keeps its version. The bulk error is caught; if every
   write error is a duplicate key the rebuild continues, otherwise it rethrows with
   the write errors attached. This is what prevents the rebuild from resurrecting a
   document that was deleted while it ran.
4. Sweep: delete the portal's rows with `updatedAt < startedAt` and `dirty: false`.
   Those are rows the rebuild did not rewrite and the worker is not about to: dead
   documents and old tombstones.
5. `computeStorageUse`: the same compare-and-set re-sum the worker's portal pass
   uses (4.4), then `summed: true` on the portal's rows written before the sum
   started. It throws if the total does not settle in five passes, which only
   happens while the worker is writing that portal continuously; the rows stay
   unsummed, so the worker's next pass repairs the total, and re-running the
   script is safe.

A rebuild running concurrently with the worker stays consistent: a row the worker
wrote during the run is skipped by step 3 (its `updatedAt` is newer) and counted
by step 5, and the compare-and-set in step 5 retries if the worker replaced the
total between the read and the write.

### 4.8 Rebuild and migration script, `scripts/rebuild-doc-usage.ts`

Dry-run by default; `--apply` writes; `--portal <address>` restricts to one
portal; `--dirty` restricts to portals with `usageDirty` and clears the flag on
apply. Safe to re-run at any time.

Pre-checks, read-only and reported, never fixed:

- live content rows with a missing `fileSize`, and with a non-numeric one
- live content rows with no `appFileId` (not billed under the new definition)
- live rows with no `ipfsType`
- `limits` rows sharing a `contractAddress` (duplicates)
- `doc-usages` rows waiting with `attempts > 0`, and portals with `usageDirty`
- the unique index on `doc-usages` and the compound index on `files`; `--apply`
  refuses to run if the unique index is missing

Then: list portals with live content (or the one given, or the dirty ones); refuse
to touch anything if the list is empty; per portal run the rebuild (apply) or the
aggregation alone (dry run), printing one line each; on a full apply, zero
`storageUse` on `limits` rows that exist, are non-zero (including negative), and
have no live content, and delete `doc-usages` rows with `updatedAt` older than the
run start and `dirty: false`; print the twenty largest movers in each direction and
the totals.

### 4.9 Configuration

`STORAGE_VERSION_CUTOFF`, integer, default 5. Validated at boot: the process refuses
to start if it is not a positive integer. A portal's `versionCutoff` that fails the
same check is ignored with one warning and the config default applies.

## 5. What does not change

- `getStorageUse`, `checkStorageLimit`, `canUpload`, `canPrivateUpload`, and both
  `/limit/use` endpoints keep reading `limits.storageUse` as a stored number.
- `storageLimit`, `extraStorage`, `extendableStorage`, `redeemMap`, floppy
  redemption, self-serve extend, and the add-extra-storage script.
- Pinning: no content version is unpinned. Gate-history pruning and the unpin crons
  are untouched.
- The client and the indexer.

## 6. Rollout

Order matters: the rebuild runs before the new code is live, so no portal is ever
served by the new code with zero rows.

1. Staging (`sepolia-dsheet-storage`): deploy, scale the `usage-refresh-cron`
   process to one dyno, dry-run, apply (the script builds both indexes itself
   before its pre-checks and reports whether they are present),
   then the smoke in the plan (publish six times, expect the sum of the newest five
   sizes; delete from the app and via the direct route, expect 0 and a tombstone
   row; force a failure and expect `usageDirty`).
2. Production, still on the old code: dry-run, read both movers lists and the
   "newest content row with no appFileId" line (a recent timestamp means a live
   flow that the new code will reject with 400; find it before deploying), apply
   to a canary with `--portal` (own and team portals), check a couple of known
   documents by hand, then full `--apply`.
3. Deploy the new code and scale the worker dyno to one. Until that dyno runs,
   nothing updates `storageUse`, so do not leave it at zero.
4. Immediately run a full `--apply` again (not `--portal`). The old code kept
   counting between step 2 and step 3 without touching rows; the second run
   repairs the documents written in that gap, and until it runs those portals
   under-count.
5. Watch the error log and Slack for `REFRESH_DOC_USAGE` failures for a day.

If the formula turns out wrong at any point, fix the code and re-run the script; it
recomputes from `files` and nothing compounds.

## 7. Expected effect on users

Usage falls for documents edited more than five times, which is the case this work
was for, and for any portal that carried rows without an `appFileId` or bytes from
the 2025-05-28 to 2025-06-16 window when every file type was billed. It cannot rise
above what the newest five versions actually occupy. The dry-run movers list shows
both directions before anything is written.

## 8. Out of scope, noted for later

- Unpinning content versions beyond the cutoff. The row records `countedVersions`
  and `cutoff`, which is the input that work will need. Until it ships, a client
  that reuses one `appFileId` for many uploads is billed only for its newest five;
  both shipping clients send real ids.
- The floppy double-count in `getStorageUse`: redemptions raise `extraStorage` and
  are also summed from `redeemMap` into `storageLimit`. Separate fix in the read path.
- Paid plans: the plan model, whatever sets `versionCutoff` and `storageLimit`, and
  the hook that calls `rebuildPortalUsage` when a portal's cutoff changes. Unlimited
  history is a large finite cutoff so the query stays bounded.
- Team-workspace storage UI in ddocs.new: workspace portals are enforced but show no
  bar, warning or publish gate. Required before any workspace gets a cutoff below
  the default.
- Indexer: the storage webhook has no block-number guard, so a late retry of an old
  delete can zero a re-published document's charge until its next publish.
- A unique index on `limits.contractAddress`, once the pre-check shows no duplicates.
- Legacy v1 portals and `legacy-portal-limits` are untouched and out of scope; a
  separate mechanism carries their usage over.
