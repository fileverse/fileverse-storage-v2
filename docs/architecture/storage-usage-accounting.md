# Storage usage accounting

How a portal's storage use is measured, stored, enforced, and repaired.

## Definition

A portal's storage use is the sum, over its live documents, of the sizes of the
newest `c` content versions of each document, where `c` is the version cutoff
(5 by default). In symbols, with `D` a document and `n` its live content
versions:

```
charge(D) = sum of fileSize over the newest min(c, n) versions of D
storageUse(portal) = sum of charge(D) over all D
```

Only `files` rows count that are `ipfsType: CONTENT`, `isDeleted: false`, and
carry a non-empty string `appFileId`. Gate, metadata, comment and image uploads
are not billed. A content upload without an `appFileId` is rejected with 400
(single routes check the type; batch routes check only when the batch carries a
content file).

Legacy (v1) portals are outside this accounting; their totals come from the
legacy storage backend as before.

## Data

`doc-usages`: one row per (portal, document).

| field | meaning |
| --- | --- |
| `contractAddress`, `appFileId` | key, unique index |
| `charge`, `countedVersions`, `latestFileSize`, `latestTimeStamp`, `cutoff` | the computed values |
| `dirty`, `dirtyAt`, `attempts`, `lastError` | row waits for the worker; retry bookkeeping |
| `summed` | `false` until the portal total has been recomputed from this row |
| `updatedAt` | when the computed values were last written |

Partial indexes serve the worker's queries: `{dirty, dirtyAt}` where `dirty`
is true, and `{summed, contractAddress}` where `summed` is false.

`limits` (existing collection) gains:

| field | meaning |
| --- | --- |
| `storageUse` | the portal total; only ever replaced by a sum of rows, never adjusted by a delta |
| `versionCutoff` | per-portal override of `STORAGE_VERSION_CUTOFF` |
| `usageDirty`, `usageDirtyAt` | portal queued for a rebuild, and since when (FIFO) |
| `usageRebuiltAt` | when the portal was last rebuilt from `files`; null means its rows are incomplete |

`files` has a compound index
`{contractAddress, appFileId, ipfsType, isDeleted, timeStamp: -1, _id: -1}` so
the per-document query is a bounded index walk.

## Request path: mark, never compute

`domain/file/create.ts`, `deleteByIpfsHashes.ts` and `deleteAll.ts` call
`markUsageDirty` after their own writes commit. It upserts the row with
`dirty: true, dirtyAt: now, attempts: 0` and nothing else. Errors are logged
and swallowed; the request never fails because of accounting.

The `/limit/use` handlers (non-legacy branch) and the upload middleware call
`flagPortalForRebuild`, a guarded update with no upsert:

```
filter: { contractAddress, usageRebuiltAt: null, usageDirty: { $ne: true } }
set:    { usageDirty: true, usageDirtyAt: now }
```

It matches at most once in a portal's life, so the first touch under this
accounting queues one rebuild and later calls are no-ops. A missing `limits`
row is left alone: such a portal has no content, and its first upload creates
a dirty row that the worker handles.

## Worker: `usage-refresh-cron`

Agenda job `REFRESH_DOC_USAGE`, every 5 seconds, defined with
`concurrency: 1`, `lockLimit: 1`, `lockLifetime` 30 minutes. Run it as exactly
one process. Each tick has two passes (`domain/limit/refreshDocUsage.ts`).

**Row pass.** Up to 200 dirty rows, oldest `dirtyAt` first. For each, run the
bounded query (newest `c` live content versions of the document), compute the
charge, and write it with `updateOne` filtered on the row's `_id` and the
`dirtyAt` it read, setting `dirty: false, summed: false`. A row re-marked
meanwhile does not match and is left for the next tick. A failure increments
`attempts` and keeps the row dirty; after five failures the row is dropped from
the queue, the portal is flagged for a rebuild, and Slack is notified.

**Portal pass.** Selection is the union of portals flagged `usageDirty`
(oldest `usageDirtyAt` first, at most `REBUILD_BATCH = 20`) and portals with
any `summed: false` row, flagged ones first. Portal state is read once for the
whole selection. Then per portal:

- `usageRebuiltAt` null, or `usageDirty` true: `rebuildPortalUsage` (below),
  then clear `usageDirty`. Rebuilds stop for the tick after twenty or once
  `REBUILD_TIME_BUDGET_MS = 60_000` has elapsed; the rest wait.
- otherwise: `computeStorageUse`, then `summed: true` on the portal's rows with
  `updatedAt <= the moment the sum started`.

`computeStorageUse` reads `storageUse`, sums `charge` over the portal's rows,
replaces `storageUse` only if it still holds the value read, and reads it back;
it repeats up to five times and then throws. Because the total is replaced
rather than adjusted, a crash or an ambiguous write error can only leave it
stale for one tick, never wrong.

A failed portal pass is logged, counted, and reported to Slack after five
consecutive failures. A failed rebuild also sets `usageDirtyAt: now` (back of
the queue) and sits out an in-process cooldown that doubles on every
consecutive failure, so one broken portal does not monopolise the worker.

The single-process assumption is load-bearing: clearing `summed` by
`updatedAt` is only correct because one process runs the job and its row pass
finishes before its portal pass starts.

## Rebuild: `rebuildPortalUsage`

Recomputes one portal from `files`:

1. Note `startedAt`; read the cutoff.
2. One aggregation over the portal's live content rows with an `appFileId`:
   sort newest first, group by document, keep the first `c` sizes and their
   sum.
3. `bulkWrite` upserts filtered on the key and `updatedAt < startedAt`, writing
   `summed: false`. A row the worker wrote during the run is newer and fails
   with a duplicate key, which is skipped: whoever wrote last wins.
4. Delete the portal's rows with `updatedAt < startedAt` and `dirty: false`
   (documents with no live content, old tombstones).
5. `computeStorageUse`, then `summed: true` on rows written before the sum
   started, then `usageRebuiltAt: now` on the `limits` row(s).

It is idempotent and safe to run concurrently with the worker.

The marker is why the portal pass never re-sums a portal without one: before
its first rebuild a portal has rows only for the documents touched since
deploy, and summing those would collapse its total to a fraction of the truth.

## Script: `scripts/rebuild-doc-usage.ts`

```
npx ts-node scripts/rebuild-doc-usage.ts [--apply] [--portal <addr>] [--dirty]
```

Dry-run by default. It waits for the connection, builds the declared indexes,
prints read-only pre-checks (rows with missing or non-numeric `fileSize`, live
content rows without `appFileId` and the newest such row, rows without
`ipfsType`, duplicate `limits` rows, rows waiting with failed attempts, flagged
portals, portals never rebuilt, index presence), then lists the portals with
live content (or the one given, or the flagged ones) and rebuilds each one on
`--apply`. A full apply also zeroes `storageUse` on `limits` rows with no live
content and sweeps stale rows. It refuses to apply without the unique index.

Because an apply stamps `usageRebuiltAt`, only run it against a deployment
that already runs this worker. Under the old code a stamped portal would skip
its first-touch rebuild.

## Rollout and operations

- Deploy, then scale `usage-refresh-cron` to one dyno at once. Until it runs,
  every counter is frozen: flags and dirty rows queue and drain later, oldest
  first.
- No script run is needed before deploy. Each portal rebuilds itself on its
  first `/limit/use` or upload attempt; that request still sees the old
  number, the next one sees the rebuilt one.
- A full `--apply` later is an optional backstop for portals nobody touched.
- Watch the tick log (`processed`, `skipped`, `failed`, `portals`, `rebuilt`,
  `deferred`, `cooling`) and Slack for `REFRESH_DOC_USAGE`. A steady
  `cooling` count points at one portal that keeps failing; `deferred` is
  backlog.
- Nothing bounds a single rebuild of a very large portal; it blocks the worker
  for its own duration.
- Never run two worker processes.

## Debug endpoint

`GET /limit/usage-by-doc[?live=1]`, same auth as `/limit/use`, serves only the
portal the token verified for. Returns the portal's stored rows, optionally a
live recompute from `files` next to each, the three totals (`storageUse`, sum
of rows, sum of live), `usageDirty`, `usageRebuiltAt`, and dirty and unsummed
counts. The ddocs.new page `/dev/storage` renders it per portal.

## Configuration

`STORAGE_VERSION_CUTOFF` (default `5`, validated at boot as a positive
integer). `limits.versionCutoff` overrides it per portal; an invalid override
is logged and ignored.
