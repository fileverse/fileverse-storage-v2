# Storage Usage Per-Document Accounting v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise the uncommitted v1 implementation on `nk/storage-usage-per-doc` to the v2 design: charge = sum of the newest `min(c, n)` version sizes, only rows with an `appFileId` count, the request path only marks documents dirty, a worker computes charges and re-sums each touched portal, the rebuild is safe against concurrent live writes, and the script gains `--dirty` and stronger pre-checks.

**Architecture:** `doc-usages` keeps one row per document with a `dirty` flag. Write sites upsert the flag and return. An agenda job in a new `usage-refresh-cron` process polls dirty rows, runs the bounded query, writes the row conditionally on its `dirtyAt`, and then replaces `limits.storageUse` with the sum of the portal's rows (compare-and-set, see the revision note below). `rebuildPortalUsage` recomputes a portal from `files` with a conditional bulk upsert, sweeps untouched non-dirty rows, and re-sums once. The script drives the rebuild for migration and repair.

**Tech Stack:** Node 16+, TypeScript 5 strict, Express, mongoose 6 (untyped models, `model("name", schema)`), agenda 5, bunyan logger, express-validation (Joi), ts-node scripts under `scripts/`.

Spec: `docs/superpowers/specs/2026-09-17-storage-usage-per-doc-design.md` (v2 revision). The v1 plan `2026-09-17-storage-usage-per-doc.md` is superseded; its code is what this plan modifies.

## Revision during execution (2026-09-18)

The Task 2 review showed that adjusting `limits.storageUse` by `$inc` deltas cannot be made safe without multi-document transactions: a crash or an ambiguous timeout between the row write and the increment either loses a delta or applies it twice. The executed code therefore differs from the Task 2 and Task 5 text below:

- `applyUsageDelta` does not exist. `processDirtyRows` runs a row pass (compute, conditional `updateOne` setting `dirty: false, summed: false`) and then a portal pass (`computeStorageUse` for every portal with a `summed: false` row, then `summed: true` on rows with `updatedAt <= the sum's start`). It returns `{ processed, skipped, failed, portals }`.
- `computeStorageUse` compare-and-sets the value it read, reads back, and loops up to five passes, throwing if the total never settles. The rebuild calls the same function.
- `doc-usages` gains `summed` (Boolean, default true) with a partial index `{ summed: 1, contractAddress: 1 }` where `summed: false`; the model is typed as `IDocUsage`. The `files` index ends in `timeStamp: -1, _id: -1`.
- The agenda job is defined with `{ concurrency: 1, lockLimit: 1 }`. The worker must run as exactly one dyno.
- Task 4's batch-route check lives in the handler and fires only when the batch contains a content file.
- The rebuild writes `summed: false` on every row it rewrites and sets `summed: true` only after its own re-sum succeeds. The script's files index name check ends in `timeStamp_-1__id_-1`.

Spec sections 4.1 to 4.7 describe the executed design; `src/domain/limit/docUsage.ts` is the reference.

## Global Constraints

- Repo: `/Users/nadeem/Desktop/Work/fileverse-storage-v2`, branch `nk/storage-usage-per-doc`. Do not switch branches or create worktrees. The v1 changes are uncommitted in the working tree; edit them in place.
- **No commits.** Nadeem reviews and commits. No `git commit`, `git add`, `git stash`, `git reset`, `git checkout`.
- **Never run any script against a database**, not even dry-run. Nadeem runs the script. Never run `heroku`, `npm install`, or anything that changes deployment state.
- **No comments that reference docs, specs, or plans**, in code or scripts. Minimal comments, only where a reader would otherwise get something wrong. No em dashes anywhere. No dynamic `import()` in new code (`models/index.ts` already has one; leave it). No `any`, no `@ts-ignore`.
- Style follows `.prettierrc.json`: double quotes, semicolons, 2-space indent, trailing commas, lines within 80 columns, newline at end of file. Eslint and prettier are not installed in this repo; match neighbouring files by eye.
- Gate per task: `npx tsc --noEmit` clean; for the script also `npx tsc --noEmit --strict --esModuleInterop --resolveJsonModule --skipLibCheck --target ES2020 --module commonjs --moduleResolution node scripts/rebuild-doc-usage.ts` clean. No unit tests.
- Formula: `charge = sum of fileSize over the newest min(c, n) live content rows`, sort `{ timeStamp: -1, _id: -1 }`, `limit(c)`, missing or non-numeric `fileSize` counts as 0. Only rows with `ipfsType: "CONTENT"`, `isDeleted: false`, and a non-empty string `appFileId` are ever billed.
- The request path never computes a charge and never writes `storageUse`. Its only accounting call is `markUsageDirtyQuietly`, which never throws.
- `storageUse` is only ever replaced with the sum of a portal's `doc-usages` rows (`computeStorageUse`), by the worker's portal pass and by the rebuild. Nothing adjusts it by a delta.
- Cutoff: `limits.versionCutoff` when a positive integer, else config `STORAGE_VERSION_CUTOFF` (default `"5"`, validated at boot), else 5.
- `MAX_ATTEMPTS = 5`, worker batch `200`, worker interval `"5 seconds"`, job name `REFRESH_DOC_USAGE`, Procfile process `usage-refresh-cron`.

## File Structure

| File | Responsibility |
|---|---|
| `src/config/index.ts` (modify) | validate `STORAGE_VERSION_CUTOFF` at boot |
| `src/infra/database/index.ts` (modify) | SIGINT handler exits instead of throwing |
| `src/infra/database/models/limit.ts` (modify) | add `usageDirty` |
| `src/infra/database/models/doc-usage.ts` (rewrite) | v2 row shape, unique and partial indexes |
| `src/infra/database/models/index.ts` (modify) | log index build failures |
| `src/domain/limit/docUsage.ts` (rewrite) | cutoff, `computeDocCharge`, `markUsageDirty`, `processDirtyRows`, `computeStorageUse`, `readStorageUse` |
| `src/domain/limit/rebuildPortalUsage.ts` (rewrite) | aggregation, conditional bulk upsert, sweep, re-sum |
| `src/domain/limit/index.ts` (modify) | exports |
| `src/domain/file/create.ts` (modify) | mark dirty on content create |
| `src/domain/file/deleteByIpfsHashes.ts` (rewrite) | match including deleted rows, mark dirty |
| `src/domain/file/deleteAll.ts` (modify) | always mark dirty |
| `src/interface/upload/batchUpload.ts`, `src/interface/privateRoute/privateBatchUpload.ts` (modify) | Joi-require `appFileId` |
| `src/interface/upload/upload.ts`, `src/interface/privateRoute/privateUpload.ts` (modify) | require `appFileId` when `ipfsType` is CONTENT |
| `src/interface/agenda/jobs/refreshDocUsage.ts` (create) | agenda job calling `processDirtyRows` |
| `src/interface/agenda/refreshDocUsageCron.ts` (create) | process entrypoint |
| `Procfile`, `package.json` (modify) | new process and scripts |
| `scripts/rebuild-doc-usage.ts` (rewrite) | migration and repair script with `--dirty` |

---

### Task 1: Models, config validation, boot hygiene

**Files:**
- Modify: `src/config/index.ts`
- Modify: `src/infra/database/index.ts`
- Modify: `src/infra/database/models/limit.ts`
- Rewrite: `src/infra/database/models/doc-usage.ts`
- Modify: `src/infra/database/models/index.ts`

**Interfaces:**
- Produces: `DocUsage` model with fields `contractAddress, appFileId, latestFileSize, countedVersions, latestTimeStamp, charge, cutoff, updatedAt, dirty, dirtyAt, attempts, lastError`; `Limit.usageDirty`.

- [ ] **Step 1: Validate the cutoff at boot**

In `src/config/index.ts`, replace the line
`config.STORAGE_VERSION_CUTOFF = config.STORAGE_VERSION_CUTOFF || "5";` with:

```ts
config.STORAGE_VERSION_CUTOFF = config.STORAGE_VERSION_CUTOFF || "5";
if (!/^[1-9]\d*$/.test(config.STORAGE_VERSION_CUTOFF)) {
  throw new Error("STORAGE_VERSION_CUTOFF must be a positive integer");
}
```

- [ ] **Step 2: SIGINT exits cleanly**

In `src/infra/database/index.ts`, replace the `process.on("SIGINT", ...)` block with:

```ts
process.on("SIGINT", function () {
  mongoose.connection.close(function () {
    logger.info(
      "Mongoose default connection disconnected through app termination"
    );
    process.exit(0);
  });
});
```

- [ ] **Step 3: `usageDirty` on limits**

In `src/infra/database/models/limit.ts`, after the `versionCutoff` field add:

```ts
  usageDirty: {
    type: Boolean,
    default: false,
  },
```

- [ ] **Step 4: Rewrite the doc-usage model**

Replace the whole of `src/infra/database/models/doc-usage.ts` with:

```ts
import { Schema, model } from "mongoose";

const docUsageSchema = new Schema({
  contractAddress: {
    type: String,
    lowercase: true,
    required: true,
  },
  appFileId: { type: String, required: true },
  latestFileSize: { type: Number, required: true },
  countedVersions: { type: Number, required: true },
  latestTimeStamp: { type: Number, required: true },
  charge: { type: Number, required: true },
  cutoff: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  dirty: { type: Boolean, default: false },
  dirtyAt: { type: Number, default: null },
  attempts: { type: Number, default: 0 },
  lastError: { type: String, default: null },
});

docUsageSchema.index({ contractAddress: 1, appFileId: 1 }, { unique: true });
docUsageSchema.index(
  { dirty: 1, dirtyAt: 1 },
  { partialFilterExpression: { dirty: true } }
);

const DocUsage = model("doc-usages", docUsageSchema);

export default DocUsage;
```

- [ ] **Step 5: Log index build failures**

In `src/infra/database/models/index.ts`, add `import { logger } from "../../logger";` after the existing imports, and before the `export {` block add:

```ts
for (const m of [File, DocUsage, Limit]) {
  m.init().catch((err: Error) => {
    logger.error(
      { model: m.modelName, err: { message: err.message, stack: err.stack } },
      "index build failed"
    );
  });
}
```

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit`
Expected: no output. (The domain files still reference the old `fileId` field and will be rewritten in Task 2; if tsc reports errors only in `src/domain/limit/*.ts` or `src/domain/file/*.ts`, note them in the report and proceed.)

---

### Task 2: Domain module `docUsage.ts`

**Files:**
- Rewrite: `src/domain/limit/docUsage.ts`
- Modify: `src/domain/limit/index.ts`

**Interfaces:**
- Produces:
  - `parseCutoff(value: unknown): number | null`
  - `resolveCutoff(versionCutoff: unknown): number`
  - `getVersionCutoff({ contractAddress }): Promise<number>`
  - `DocCharge = { latestFileSize; countedVersions; latestTimeStamp; charge }`
  - `computeDocCharge({ contractAddress, appFileId, cutoff }): Promise<DocCharge>`
  - `markUsageDirty({ contractAddress, appFileIds }): Promise<number>`
  - `markUsageDirtyQuietly(params, context): Promise<number | null>`
  - `applyUsageDelta({ contractAddress, delta }): Promise<void>`
  - `processDirtyRows({ limit }): Promise<{ processed; skipped; failed }>`
  - `computeStorageUse({ contractAddress }): Promise<number>`
  - `readStorageUse(contractAddress): Promise<number>`
- Removed: `DocKey`, `docKeyForRow`, `computeDocUsage`, `refreshUsage`, `refreshUsageQuietly`.

- [ ] **Step 1: Rewrite the module**

Replace the whole of `src/domain/limit/docUsage.ts` with:

```ts
import { config } from "../../config";
import { DocUsage, File, Limit } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { reportError } from "../../infra/reporter";
import { FileIPFSType } from "../../types";

const DEFAULT_CUTOFF = 5;
const DUPLICATE_KEY = 11000;
const MAX_ATTEMPTS = 5;

const serializeError = (err: unknown) =>
  err instanceof Error ? { message: err.message, stack: err.stack } : err;

export const parseCutoff = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const resolveCutoff = (versionCutoff: unknown): number =>
  parseCutoff(versionCutoff) ??
  parseCutoff(config.STORAGE_VERSION_CUTOFF) ??
  DEFAULT_CUTOFF;

export const getVersionCutoff = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<number> => {
  const limit = await Limit.findOne({
    contractAddress: contractAddress.toLowerCase(),
  }).select("versionCutoff");
  const raw = limit?.versionCutoff;
  if (raw !== null && raw !== undefined && parseCutoff(raw) === null) {
    logger.warn(
      { contractAddress, versionCutoff: raw },
      "ignoring invalid versionCutoff; config default applies"
    );
  }
  return resolveCutoff(raw);
};

export interface DocCharge {
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
}

export const computeDocCharge = async ({
  contractAddress,
  appFileId,
  cutoff,
}: {
  contractAddress: string;
  appFileId: string;
  cutoff: number;
}): Promise<DocCharge> => {
  const safeCutoff = parseCutoff(cutoff) ?? 1;
  const rows = await File.find({
    contractAddress: contractAddress.toLowerCase(),
    appFileId,
    ipfsType: FileIPFSType.CONTENT,
    isDeleted: false,
  })
    .sort({ timeStamp: -1, _id: -1 })
    .limit(safeCutoff)
    .select("fileSize timeStamp");
  const sizes = rows.map((r) => Number(r.fileSize) || 0);
  return {
    latestFileSize: sizes[0] ?? 0,
    countedVersions: rows.length,
    latestTimeStamp: Number(rows[0]?.timeStamp) || 0,
    charge: sizes.reduce((sum, size) => sum + size, 0),
  };
};

const upsertOnce = async (
  filter: Record<string, unknown>,
  update: Record<string, unknown>
) => {
  try {
    await DocUsage.updateOne(filter, update, { upsert: true });
  } catch (err) {
    // A concurrent insert of the same row can win the race; the same upsert
    // then updates it.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    await DocUsage.updateOne(filter, update, { upsert: true });
  }
};

export const markUsageDirty = async ({
  contractAddress,
  appFileIds,
}: {
  contractAddress: string;
  appFileIds: string[];
}): Promise<number> => {
  const portal = contractAddress.toLowerCase();
  const now = Date.now();
  const ids = [...new Set(appFileIds.filter((id) => id && id.length > 0))];
  for (const appFileId of ids) {
    await upsertOnce(
      { contractAddress: portal, appFileId },
      {
        $set: { dirty: true, dirtyAt: now, attempts: 0 },
        $setOnInsert: {
          latestFileSize: 0,
          countedVersions: 0,
          latestTimeStamp: 0,
          charge: 0,
          cutoff: 0,
          updatedAt: 0,
          lastError: null,
        },
      }
    );
  }
  return ids.length;
};

export const markUsageDirtyQuietly = async (
  params: { contractAddress: string; appFileIds: string[] },
  context: Record<string, unknown>
): Promise<number | null> => {
  try {
    return await markUsageDirty(params);
  } catch (err) {
    logger.error(
      {
        ...context,
        contractAddress: params.contractAddress,
        appFileIds: params.appFileIds,
        err: serializeError(err),
      },
      "failed to mark storage usage dirty; row write already committed"
    );
    return null;
  }
};

export const applyUsageDelta = async ({
  contractAddress,
  delta,
}: {
  contractAddress: string;
  delta: number;
}): Promise<void> => {
  if (delta === 0) return;
  const portal = contractAddress.toLowerCase();
  await Limit.updateOne(
    { contractAddress: portal },
    { $inc: { storageUse: delta }, $setOnInsert: { contractAddress: portal } },
    { upsert: delta > 0 }
  );
};

export const readStorageUse = async (
  contractAddress: string
): Promise<number> => {
  const limit = await Limit.findOne({ contractAddress }).select("storageUse");
  return limit?.storageUse ? Number(limit.storageUse) : 0;
};

export const computeStorageUse = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<number> => {
  const portal = contractAddress.toLowerCase();
  const [agg] = await DocUsage.aggregate([
    { $match: { contractAddress: portal } },
    { $group: { _id: null, total: { $sum: "$charge" } } },
  ]);
  const total: number = agg?.total ?? 0;
  await Limit.updateOne(
    { contractAddress: portal },
    { $set: { storageUse: total }, $setOnInsert: { contractAddress: portal } },
    { upsert: true }
  );
  return total;
};

type DirtyRow = {
  _id: unknown;
  contractAddress: string;
  appFileId: string;
  dirtyAt: number | null;
  attempts?: number;
  charge?: number;
};

const recordFailure = async (row: DirtyRow, err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const attempts = (Number(row.attempts) || 0) + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  try {
    await DocUsage.updateOne(
      { _id: row._id },
      {
        $set: {
          attempts,
          lastError: message,
          ...(exhausted ? { dirty: false } : {}),
        },
      }
    );
    if (!exhausted) return;
    await Limit.updateOne(
      { contractAddress: row.contractAddress },
      { $set: { usageDirty: true } }
    );
    logger.error(
      {
        contractAddress: row.contractAddress,
        appFileId: row.appFileId,
        attempts,
        err: serializeError(err),
      },
      "storage usage refresh gave up; portal marked dirty"
    );
    await reportError(
      `storage usage refresh gave up for ${row.contractAddress} / ` +
        `${row.appFileId}: ${message}`
    ).catch(() => undefined);
  } catch (recordErr) {
    logger.error(
      {
        contractAddress: row.contractAddress,
        appFileId: row.appFileId,
        err: serializeError(recordErr),
      },
      "could not record storage usage refresh failure"
    );
  }
};

export const processDirtyRows = async ({
  limit,
}: {
  limit: number;
}): Promise<{ processed: number; skipped: number; failed: number }> => {
  const rows: DirtyRow[] = await DocUsage.find({ dirty: true })
    .sort({ dirtyAt: 1 })
    .limit(limit)
    .lean();
  const cutoffs = new Map<string, number>();
  const result = { processed: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    const portal = row.contractAddress;
    try {
      let cutoff = cutoffs.get(portal);
      if (cutoff === undefined) {
        cutoff = await getVersionCutoff({ contractAddress: portal });
        cutoffs.set(portal, cutoff);
      }
      const computed = await computeDocCharge({
        contractAddress: portal,
        appFileId: row.appFileId,
        cutoff,
      });
      const previous = await DocUsage.findOneAndUpdate(
        { _id: row._id, dirtyAt: row.dirtyAt },
        {
          $set: {
            ...computed,
            cutoff,
            updatedAt: Date.now(),
            dirty: false,
            attempts: 0,
            lastError: null,
          },
        },
        { new: false }
      );
      if (!previous) {
        // Re-marked while computing; the next tick recomputes it.
        result.skipped += 1;
        continue;
      }
      await applyUsageDelta({
        contractAddress: portal,
        delta: computed.charge - (Number(previous.charge) || 0),
      });
      result.processed += 1;
    } catch (err) {
      result.failed += 1;
      await recordFailure(row, err);
    }
  }
  return result;
};
```

- [ ] **Step 2: Update the barrel**

Replace the `docUsage` export block in `src/domain/limit/index.ts` (keep the five pre-existing exports above it and the `rebuildPortalUsage` exports below it) with:

```ts
export {
  parseCutoff,
  resolveCutoff,
  getVersionCutoff,
  computeDocCharge,
  markUsageDirty,
  markUsageDirtyQuietly,
  applyUsageDelta,
  processDirtyRows,
  computeStorageUse,
  readStorageUse,
} from "./docUsage";
export type { DocCharge } from "./docUsage";
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit`
Expected: errors only in `src/domain/limit/rebuildPortalUsage.ts`, `src/domain/file/create.ts`, `deleteByIpfsHashes.ts`, `deleteAll.ts` (they still import removed names; Tasks 3 and 4 fix them). Report which files error. No errors in `docUsage.ts` or `index.ts`.

---

### Task 3: Rebuild module

**Files:**
- Rewrite: `src/domain/limit/rebuildPortalUsage.ts`

**Interfaces:**
- Consumes: `computeStorageUse`, `getVersionCutoff`, `parseCutoff`, `readStorageUse` from `./docUsage`.
- Produces: `PortalDocUsage = { appFileId; latestFileSize; countedVersions; latestTimeStamp; charge }`, `computePortalDocUsages({ contractAddress, cutoff }): Promise<PortalDocUsage[]>`, `rebuildPortalUsage({ contractAddress }): Promise<{ docs; skipped; before; after }>`.

- [ ] **Step 1: Rewrite the module**

Replace the whole of `src/domain/limit/rebuildPortalUsage.ts` with:

```ts
import { DocUsage, File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import {
  computeStorageUse,
  getVersionCutoff,
  parseCutoff,
  readStorageUse,
} from "./docUsage";

const DUPLICATE_KEY = 11000;

export interface PortalDocUsage {
  appFileId: string;
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
}

type WriteError = { code?: number; errmsg?: string; index?: number };
type BulkFailure = { writeErrors?: WriteError[] };

export const computePortalDocUsages = async ({
  contractAddress,
  cutoff,
}: {
  contractAddress: string;
  cutoff: number;
}): Promise<PortalDocUsage[]> => {
  const safeCutoff = parseCutoff(cutoff) ?? 1;
  const portal = contractAddress.toLowerCase();
  const groups: {
    _id: string;
    sizes: unknown[];
    latestTimeStamp: number | null;
  }[] = await File.aggregate([
    {
      $match: {
        contractAddress: portal,
        ipfsType: FileIPFSType.CONTENT,
        isDeleted: false,
        appFileId: { $type: "string", $ne: "" },
      },
    },
    { $sort: { timeStamp: -1, _id: -1 } },
    // $push and $first below rely on the $sort above running first; that
    // holds on an unsharded deployment.
    {
      $group: {
        _id: "$appFileId",
        sizes: { $push: { $ifNull: ["$fileSize", 0] } },
        latestTimeStamp: { $first: "$timeStamp" },
      },
    },
    {
      $project: {
        sizes: { $slice: ["$sizes", safeCutoff] },
        latestTimeStamp: 1,
      },
    },
  ]).allowDiskUse(true);

  return groups.map((g) => {
    const sizes = g.sizes.map((s) => Number(s) || 0);
    return {
      appFileId: g._id,
      latestFileSize: sizes[0] ?? 0,
      countedVersions: sizes.length,
      latestTimeStamp: Number(g.latestTimeStamp) || 0,
      charge: sizes.reduce((sum, size) => sum + size, 0),
    };
  });
};

const onlyDuplicateKeys = (errors: WriteError[] | undefined) =>
  Array.isArray(errors) &&
  errors.length > 0 &&
  errors.every((e) => e.code === DUPLICATE_KEY);

export const rebuildPortalUsage = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<{
  docs: number;
  skipped: number;
  before: number;
  after: number;
}> => {
  const portal = contractAddress.toLowerCase();
  const startedAt = Date.now();
  const before = await readStorageUse(portal);
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({
    contractAddress: portal,
    cutoff,
  });

  let skipped = 0;
  if (docs.length > 0) {
    const ops = docs.map((d) => {
      // Only rows untouched since startedAt are overwritten; a row the
      // worker wrote during this run wins and shows up as a duplicate key.
      const filter: { contractAddress: string } & Record<string, unknown> = {
        contractAddress: portal,
        appFileId: d.appFileId,
        updatedAt: { $lt: startedAt },
      };
      return {
        updateOne: {
          filter,
          update: {
            $set: {
              latestFileSize: d.latestFileSize,
              countedVersions: d.countedVersions,
              latestTimeStamp: d.latestTimeStamp,
              charge: d.charge,
              cutoff,
              updatedAt: Date.now(),
            },
            $setOnInsert: {
              dirty: false,
              dirtyAt: null,
              summed: true,
              attempts: 0,
              lastError: null,
            },
          },
          upsert: true,
        },
      };
    });
    try {
      await DocUsage.bulkWrite(ops, { ordered: false });
    } catch (err) {
      const errors = (err as BulkFailure).writeErrors;
      if (!onlyDuplicateKeys(errors)) {
        const detail = (errors ?? [])
          .slice(0, 3)
          .map((e) => `${e.code}: ${e.errmsg}`)
          .join("; ");
        throw new Error(
          `doc-usage bulk write failed for ${portal}: ${detail || String(err)}`
        );
      }
      skipped = errors?.length ?? 0;
    }
  }

  // Rows neither rewritten above nor waiting for the worker belong to
  // documents with no live content.
  await DocUsage.deleteMany({
    contractAddress: portal,
    updatedAt: { $lt: startedAt },
    dirty: false,
  });

  const after = await computeStorageUse({ contractAddress: portal });
  return { docs: docs.length, skipped, before, after };
};
```

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit`
Expected: errors only in `src/domain/file/{create,deleteByIpfsHashes,deleteAll}.ts` (Task 4). None in `src/domain/limit/`.

---

### Task 4: Write sites and `appFileId` validation

**Files:**
- Modify: `src/domain/file/create.ts`
- Rewrite: `src/domain/file/deleteByIpfsHashes.ts`
- Modify: `src/domain/file/deleteAll.ts`
- Modify: `src/interface/upload/batchUpload.ts`
- Modify: `src/interface/privateRoute/privateBatchUpload.ts`
- Modify: `src/interface/upload/upload.ts`
- Modify: `src/interface/privateRoute/privateUpload.ts`

**Interfaces:**
- Consumes: `markUsageDirtyQuietly` from `../limit/docUsage`.
- Produces: `deleteByIpfsHashes` still returns `{ deletedCount: number; bytesFreed: number }` (bytesFreed always 0); `deleteAll` still returns the `updateMany` result.

- [ ] **Step 1: create.ts**

Replace the import line `import { docKeyForRow, refreshUsageQuietly } from "../limit/docUsage";` with `import { markUsageDirtyQuietly } from "../limit/docUsage";` and replace the final `if (newFile.ipfsType === FileIPFSType.CONTENT) { ... }` block with:

```ts
  if (newFile.ipfsType === FileIPFSType.CONTENT && newFile.appFileId) {
    await markUsageDirtyQuietly(
      { contractAddress, appFileIds: [newFile.appFileId] },
      { ipfsHash: newFile.ipfsHash }
    );
  }
```

- [ ] **Step 2: deleteByIpfsHashes.ts**

Replace the whole file with:

```ts
import { File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import { markUsageDirtyQuietly } from "../limit/docUsage";

interface IDeleteByIpfsHashesParams {
  contractAddress: string;
  ipfsHashes: string[];
}

export const deleteByIpfsHashes = async ({
  contractAddress,
  ipfsHashes,
}: IDeleteByIpfsHashesParams) => {
  const portal = contractAddress.toLowerCase();
  // Already-deleted rows are matched too so a retry still marks the
  // document for a recompute.
  const matchedFiles = await File.find({
    ipfsHash: { $in: ipfsHashes },
    contractAddress: portal,
  }).select("isDeleted ipfsType appFileId");

  if (matchedFiles.length === 0) {
    return { deletedCount: 0, bytesFreed: 0 };
  }

  const liveIds = matchedFiles.filter((f) => !f.isDeleted).map((f) => f._id);
  if (liveIds.length > 0) {
    await File.updateMany(
      { _id: { $in: liveIds } },
      { $set: { isDeleted: true, markedForUnpin: true } }
    );
  }

  const appFileIds = matchedFiles
    .filter((f) => f.ipfsType === FileIPFSType.CONTENT && f.appFileId)
    .map((f) => String(f.appFileId));
  if (appFileIds.length > 0) {
    await markUsageDirtyQuietly(
      { contractAddress: portal, appFileIds },
      { ipfsHashes }
    );
  }

  return { deletedCount: liveIds.length, bytesFreed: 0 };
};
```

- [ ] **Step 3: deleteAll.ts**

Replace the import `import { refreshUsageQuietly } from "../limit/docUsage";` with `import { markUsageDirtyQuietly } from "../limit/docUsage";` and replace the `if (result.modifiedCount > 0) { ... }` block with:

```ts
  await markUsageDirtyQuietly(
    {
      contractAddress: criteria.contractAddress,
      appFileIds: [criteria.appFileId],
    },
    { appFileId: criteria.appFileId }
  );
```

- [ ] **Step 4: Batch routes require `appFileId` when a content file is present**

In both `src/interface/upload/batchUpload.ts` and `src/interface/privateRoute/privateBatchUpload.ts`, leave `batchUploadValidation` as it is and add this guard in the handler directly after the existing "Invalid request" check (gate-only and metadata-only batches carry no `appFileId` and must keep working):

```ts
  const hasContent = files.some(
    (file) => getIPFSTypeFromFileName(file.name) === FileIPFSType.CONTENT
  );
  if (hasContent && !(typeof appFileId === "string" && appFileId)) {
    return throwError({
      code: 400,
      message: "appFileId is required for content uploads",
      req,
    });
  }
```

- [ ] **Step 5: Single-file routes require `appFileId` for content**

In `src/interface/upload/upload.ts` and `src/interface/privateRoute/privateUpload.ts`, directly after the existing `if (!contractAddress || !invokerAddress || !file) { ... }` guard, add:

```ts
  if (ipfsType === "CONTENT" && !(typeof appFileId === "string" && appFileId)) {
    return throwError({
      code: 400,
      message: "appFileId is required for content uploads",
      req,
    });
  }
```

If `privateUpload.ts` guards on different variables, place the check after its equivalent request guard and keep the same message.

- [ ] **Step 6: Gate and sanity greps**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `grep -rn "storageUse" src | grep -v "src/domain/limit/\|src/interface/limit\|src/interface/v2/limit\|models/limit.ts\|middleware/canUpload\|middleware/canPrivateUpload"`
Expected: nothing (no write site touches `storageUse`).

Run: `grep -rn "refreshUsage\|docKeyForRow\|computeDocUsage\|DocKey" src scripts`
Expected: nothing.

---

### Task 5: Worker job and process

**Files:**
- Create: `src/interface/agenda/jobs/refreshDocUsage.ts`
- Create: `src/interface/agenda/refreshDocUsageCron.ts`
- Modify: `Procfile`
- Modify: `package.json`

**Interfaces:**
- Consumes: `processDirtyRows` from `../../../domain/limit`.

- [ ] **Step 1: Job**

Create `src/interface/agenda/jobs/refreshDocUsage.ts`:

```ts
import { Job } from "agenda";
import { agenda } from "../";
import { logger } from "../../../infra/logger";
import { processDirtyRows } from "../../../domain/limit";

const JOB_NAME = "REFRESH_DOC_USAGE";
const BATCH_SIZE = 200;

async function jobDefinition(job: Job, done: (args?: unknown) => void) {
  try {
    const result = await processDirtyRows({ limit: BATCH_SIZE });
    if (
      result.processed ||
      result.skipped ||
      result.failed ||
      result.portals
    ) {
      logger.info({ job: JOB_NAME, ...result }, "doc usage refresh tick");
    }
    done();
  } catch (error) {
    logger.error(`Error in ${JOB_NAME} job:`, error);
    done(error);
  }
}

async function setupJob() {
  agenda.define(JOB_NAME, jobDefinition);
  agenda.every("5 seconds", JOB_NAME);
}

export default { setupJob, jobDefinition };
```

- [ ] **Step 2: Process entrypoint**

Create `src/interface/agenda/refreshDocUsageCron.ts`, mirroring `unpinDeletedFileCron.ts`:

```ts
import { agenda } from ".";
import { logger } from "../../infra/logger";
import refreshDocUsage from "./jobs/refreshDocUsage";

async function graceful() {
  await agenda.stop();
  process.exit(0);
}

(async function () {
  try {
    await agenda.start();
    await refreshDocUsage.setupJob();
  } catch (err) {
    logger.error(err);
    await graceful();
  }
})();

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);
```

- [ ] **Step 3: Procfile and scripts**

Append to `Procfile`:

```
usage-refresh-cron: npm run start:usage-refresh-cron
```

In `package.json` `scripts`, after `start:resolve-user-op-hash-cron` add:

```json
    "start:usage-refresh-cron": "NODE_ENV=production node dist/interface/agenda/refreshDocUsageCron.js",
    "dev:usage-refresh-cron": "nodemon --exec ts-node src/interface/agenda/refreshDocUsageCron.ts",
```

Do not run `npm install`; editing `scripts` does not touch the lockfile.

- [ ] **Step 4: Gate**

Run: `npx tsc --noEmit`
Expected: no output. Confirm `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` prints nothing (valid JSON).

---

### Task 6: Rebuild script

**Files:**
- Rewrite: `scripts/rebuild-doc-usage.ts`

**Interfaces:**
- Consumes: `computePortalDocUsages`, `rebuildPortalUsage`, `getVersionCutoff`, `readStorageUse` from `../src/domain/limit`; models `File`, `Limit`, `DocUsage`.

- [ ] **Step 1: Rewrite the script**

Replace the whole file with:

```ts
import "../src/infra/database";
import mongoose from "mongoose";
import { DocUsage, File, Limit } from "../src/infra/database/models";
import {
  computePortalDocUsages,
  getVersionCutoff,
  readStorageUse,
  rebuildPortalUsage,
} from "../src/domain/limit";
import { FileIPFSType } from "../src/types";

// Usage: npx ts-node scripts/rebuild-doc-usage.ts [--apply] [--portal <addr>]
//        [--dirty]
//
// Rebuilds doc-usages and limits.storageUse from the files collection. Dry-run
// by default: prints what would change and writes nothing. Safe to re-run.
// --dirty restricts the run to portals flagged usageDirty and clears the flag.

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const onlyDirty = args.includes("--dirty");
const portalArgIndex = args.indexOf("--portal");
const onlyPortal =
  portalArgIndex >= 0 ? args[portalArgIndex + 1]?.toLowerCase() : undefined;

if (portalArgIndex >= 0 && !/^0x[0-9a-f]{40}$/.test(onlyPortal ?? "")) {
  console.error("--portal expects a 0x address");
  process.exit(1);
}
if (onlyPortal && onlyDirty) {
  console.error("--portal and --dirty cannot be combined");
  process.exit(1);
}

const toGB = (v: number) => `${(v / 1e9).toFixed(3)} GB`;

const portalFilter = onlyPortal ? { contractAddress: onlyPortal } : {};
const liveContent = {
  ipfsType: FileIPFSType.CONTENT,
  isDeleted: false,
  ...portalFilter,
};
const billable = {
  ...liveContent,
  appFileId: { $type: "string", $ne: "" },
};

async function indexNames(collection: string): Promise<string[]> {
  const indexes = await mongoose.connection.db
    .collection(collection)
    .indexes();
  return indexes.map((i: { name?: string }) => i.name ?? "");
}

async function preChecks(): Promise<{ uniqueIndexPresent: boolean }> {
  const [
    noFileSize,
    badFileSize,
    noAppFileId,
    noIpfsType,
    waitingRows,
    dirtyPortals,
    docUsageIndexes,
    fileIndexes,
    duplicateLimits,
  ] = await Promise.all([
    File.countDocuments({ ...liveContent, fileSize: null }),
    File.countDocuments({
      ...liveContent,
      fileSize: { $exists: true, $not: { $type: "number" } },
    }),
    File.countDocuments({
      ...liveContent,
      $or: [{ appFileId: null }, { appFileId: "" }],
    }),
    File.countDocuments({ isDeleted: false, ipfsType: null, ...portalFilter }),
    DocUsage.countDocuments({ attempts: { $gt: 0 }, ...portalFilter }),
    Limit.countDocuments({ usageDirty: true, ...portalFilter }),
    indexNames("doc-usages"),
    indexNames("files"),
    Limit.aggregate([
      { $group: { _id: "$contractAddress", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $count: "portals" },
    ]),
  ]);
  const uniqueIndexPresent = docUsageIndexes.includes(
    "contractAddress_1_appFileId_1"
  );
  const fileIndexPresent = fileIndexes.includes(
    "contractAddress_1_appFileId_1_ipfsType_1_isDeleted_1_timeStamp_-1"
  );
  console.log("Pre-checks (live rows):");
  console.log(`  content rows with no fileSize:          ${noFileSize}`);
  console.log(`  content rows with non-numeric fileSize: ${badFileSize}`);
  console.log(`  content rows with no appFileId (unbilled): ${noAppFileId}`);
  console.log(`  rows with no ipfsType:                  ${noIpfsType}`);
  console.log(`  doc-usage rows with failed attempts:    ${waitingRows}`);
  console.log(`  portals flagged usageDirty:             ${dirtyPortals}`);
  console.log(
    `  limits rows sharing a contractAddress:  ` +
      `${duplicateLimits[0]?.portals ?? 0} portals`
  );
  console.log(`  doc-usages unique index present:        ${uniqueIndexPresent}`);
  console.log(`  files compound index present:           ${fileIndexPresent}`);
  return { uniqueIndexPresent };
}

async function listPortals(): Promise<string[]> {
  if (onlyPortal) return [onlyPortal];
  if (onlyDirty) {
    const rows = await Limit.find({ usageDirty: true }).select(
      "contractAddress"
    );
    return rows
      .map((r) => String(r.contractAddress ?? ""))
      .filter(Boolean)
      .map((p) => p.toLowerCase());
  }
  const portals: string[] = await File.distinct("contractAddress", billable);
  return portals.filter(Boolean).map((p) => p.toLowerCase());
}

async function dryRunPortal(portal: string) {
  const before = await readStorageUse(portal);
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({
    contractAddress: portal,
    cutoff,
  });
  const after = docs.reduce((sum, d) => sum + d.charge, 0);
  return { docs: docs.length, skipped: 0, before, after };
}

async function orphanedLimits(portalsWithContent: Set<string>) {
  const rows = await Limit.find({
    storageUse: { $exists: true, $ne: 0 },
    ...portalFilter,
  }).select("contractAddress storageUse");
  return rows.filter(
    (r) => r.contractAddress && !portalsWithContent.has(r.contractAddress)
  );
}

async function main() {
  const mode = apply ? "apply" : "dry-run (pass --apply to write)";
  console.log(`MODE: ${mode}${onlyDirty ? ", dirty portals only" : ""}`);

  if (onlyPortal) {
    const hasContent = await File.exists(liveContent);
    const hasLimit = await Limit.exists({ contractAddress: onlyPortal });
    if (!hasContent && !hasLimit) {
      console.log(
        `Portal ${onlyPortal} has no live content and no limits row; ` +
          "nothing to rebuild"
      );
      await mongoose.connection.close();
      return;
    }
  }

  console.log("Running pre-checks...");
  const { uniqueIndexPresent } = await preChecks();
  if (apply && !uniqueIndexPresent) {
    console.error(
      "Refusing to apply: the unique index on doc-usages is missing. " +
        "Boot the server once so mongoose builds it, then re-run."
    );
    await mongoose.connection.close();
    process.exit(1);
  }

  const portals = await listPortals();
  console.log(`\nPortals to process: ${portals.length}`);

  if (portals.length === 0) {
    console.log("No portals to process; refusing to touch limits or doc-usages");
    await mongoose.connection.close();
    return;
  }

  const movers: {
    portal: string;
    docs: number;
    skipped: number;
    before: number;
    after: number;
  }[] = [];
  const runStartedAt = Date.now();
  for (const [i, portal] of portals.entries()) {
    const r = apply
      ? await rebuildPortalUsage({ contractAddress: portal })
      : await dryRunPortal(portal);
    movers.push({ portal, ...r });
    const label = apply ? "" : "would-be ";
    const skipped = r.skipped ? ` skipped=${r.skipped}` : "";
    console.log(
      `[${i + 1}/${portals.length}] ${portal} ${label}` +
        `${toGB(r.before)} -> ${toGB(r.after)} docs=${r.docs}${skipped}`
    );
    if (apply && onlyDirty) {
      await Limit.updateOne(
        { contractAddress: portal },
        { $set: { usageDirty: false } }
      );
    }
  }

  const fullRun = !onlyPortal && !onlyDirty;
  const orphans = fullRun ? await orphanedLimits(new Set(portals)) : [];
  if (apply && orphans.length > 0) {
    await Limit.updateMany(
      { _id: { $in: orphans.map((o) => o._id) } },
      { $set: { storageUse: 0 } }
    );
  }
  if (apply && fullRun) {
    const { deletedCount } = await DocUsage.deleteMany({
      updatedAt: { $lt: runStartedAt },
      dirty: false,
    });
    console.log(
      `Removed ${deletedCount} doc-usage rows for documents with no live ` +
        "content"
    );
  }
  if (fullRun) {
    console.log(
      `Limits rows with non-zero storageUse and no live content: ` +
        `${orphans.length}` +
        (apply ? " (set to 0)" : " (would be set to 0)")
    );
  }

  const byDelta = [...movers].sort(
    (a, b) => a.after - a.before - (b.after - b.before)
  );
  const print = (title: string, rows: typeof movers) => {
    console.log(`\n${title}`);
    for (const m of rows) {
      console.log(
        `  ${m.portal}  docs=${m.docs}  ${toGB(m.before)} -> ${toGB(m.after)}`
      );
    }
  };
  print("Largest decreases:", byDelta.slice(0, 20));
  print("Largest increases:", byDelta.slice(-20).reverse());

  const totalBefore = movers.reduce((s, m) => s + m.before, 0);
  const totalAfter = movers.reduce((s, m) => s + m.after, 0);
  console.log(
    `\nTotal across portals: ${toGB(totalBefore)} -> ${toGB(totalAfter)}`
  );

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("ERROR:", err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Gate**

Run: `npx tsc --noEmit --strict --esModuleInterop --resolveJsonModule --skipLibCheck --target ES2020 --module commonjs --moduleResolution node scripts/rebuild-doc-usage.ts`
Expected: no output. If `mongoose.connection.db` is typed as possibly undefined under this mongoose version, guard with `if (!mongoose.connection.db) throw new Error("not connected");` at the top of `indexNames`.

Run: `npx tsc --noEmit`
Expected: no output.

Run: `awk 'length > 80' scripts/rebuild-doc-usage.ts`
Expected: no output.

---

### Task 7: Diff hygiene

**Files:** none new.

- [ ] **Step 1: Doc references, em dashes, dynamic imports, any**

Run:

```bash
{ git diff; cat src/infra/database/models/doc-usage.ts src/domain/limit/docUsage.ts src/domain/limit/rebuildPortalUsage.ts src/interface/agenda/jobs/refreshDocUsage.ts src/interface/agenda/refreshDocUsageCron.ts scripts/rebuild-doc-usage.ts; } | grep -n "docs/\|spec section\|—\|import(\|as any\|ts-ignore"
```

Expected: no output.

- [ ] **Step 2: Line width and trailing newlines**

Run, for every changed or new `.ts` file: `awk 'length > 80' <file>` and `tail -c1 <file> | xxd | grep -c 0a`.
Expected: no long lines; `1` for each file.

- [ ] **Step 3: Full gates**

Run: `npx tsc --noEmit` and the script tsc command from Task 6.
Expected: no output from either.

- [ ] **Step 4: Stop for review**

Do not commit. Report the list of changed and created files to Nadeem.

---

### Task 8: Staging smoke (manual, on request only)

Run by Nadeem on `sepolia-dsheet-storage`. Never run by an agent.

- [ ] Scale `usage-refresh-cron` to one dyno on staging (Heroku dashboard).
- [ ] After deploy, confirm `db["doc-usages"].getIndexes()` shows `contractAddress_1_appFileId_1` (unique) and `dirty_1_dirtyAt_1` (partial), and `db.files.getIndexes()` shows the compound index.
- [ ] `npx ts-node scripts/rebuild-doc-usage.ts` (dry run), read the report; then `--apply`.
- [ ] Publish a new document once; within 10 seconds expect one `doc-usages` row with `countedVersions 1`, `charge` equal to the content `fileSize`, `dirty false`.
- [ ] Republish it six times; expect `countedVersions 5` and `charge` equal to the sum of the five newest content rows' `fileSize`, and `limits.storageUse` moved by exactly the sum of the deltas.
- [ ] Delete it from the app; after the indexer webhook, expect `charge 0`, `countedVersions 0`, row still present, `storageUse` reduced by the previous charge.
- [ ] Delete another document through `DELETE /file/:appFileId`; expect the same.
- [ ] Send the same delete webhook again; expect no error and no change.
- [ ] Force a failure (temporarily set a portal's `versionCutoff` to `"x"` is not enough, since it is ignored; instead stop the worker, mark a row dirty by publishing, and confirm it stays dirty; restart the worker and confirm it clears). Optionally set `attempts: 4` on a dirty row and point the worker at an unreachable `files` query to see `usageDirty` flip; skip if impractical.
- [ ] Set `versionCutoff: 2` on the test portal and run `--portal <addr> --apply`; expect `countedVersions 2` on the six-version document and `cutoff 2` on its row.
- [ ] Set `usageDirty: true` on the test portal and run `--dirty --apply`; expect the flag cleared and the portal rebuilt.
