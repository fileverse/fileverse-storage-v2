# Storage Usage Per-Document Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the running `storageUse` counter with a derived value: per live document, latest content size times min(cutoff, live content versions), summed per portal, with the cutoff resolvable per portal.

**Architecture:** A new `doc-usages` collection holds one row per live document, refreshed by a query bounded to the cutoff on every content write or delete. The portal's `storageUse` is set to the sum of its doc rows after each refresh, so every existing reader and the upload guard keep working unchanged. A per-portal bulk rebuild backs both the one-time migration script and any future cutoff change.

**Tech Stack:** Node 16+, TypeScript 5 strict, Express, mongoose 6 (untyped models, `model("name", schema)`), bunyan logger, ts-node scripts under `scripts/`.

Spec: `docs/superpowers/specs/2026-09-17-storage-usage-per-doc-design.md`.

## Global Constraints

- Repo: `/Users/nadeem/Desktop/Work/fileverse-storage-v2`, branch `nk/storage-usage-per-doc` (created from `main`). Do not switch branches or create worktrees.
- **No commits.** Nadeem reviews and commits. Leave every change uncommitted. No `git commit`, `add -A`, stash, or reset.
- **No comments that reference docs, specs, or plans**, in code or scripts. Say the one-line reason inline or leave the comment out. Before finishing, run `git diff | grep -n "docs/\|spec section"` and remove every hit you introduced.
- **Minimal comments.** Only where a reader would otherwise get something wrong. No narration of what the code does.
- No em dashes anywhere in code, comments, or log strings.
- No dynamic `import()` in new code. (`models/index.ts` already has one; leave it.)
- Style follows `.prettierrc.json`: double quotes, semicolons, 2-space indent, trailing commas where prettier puts them.
- Gate per task: `npx tsc --noEmit` clean and `npx eslint <changed files>` clean. No unit tests are added; verification is tsc, eslint, and the manual checks in Task 7.
- Per-document hot-path query is `find().sort({ timeStamp: -1 }).limit(cutoff)`. Never an unbounded per-document read on the write path.
- Only rows with `ipfsType: "CONTENT"` and `isDeleted: false` are ever billed.
- Default cutoff is config `STORAGE_VERSION_CUTOFF`, default `"5"`; per-portal override is `limits.versionCutoff`.
- Every refresh failure after a successful row write is logged and swallowed; the upload or delete response is never failed by accounting.

## File Structure

| File | Responsibility |
|---|---|
| `src/config/index.ts` (modify) | default `STORAGE_VERSION_CUTOFF` |
| `src/config/.env.example` (modify) | document the new variable |
| `src/infra/database/models/limit.ts` (modify) | add nullable `versionCutoff` |
| `src/infra/database/models/file.ts` (modify) | compound index for the bounded per-document query |
| `src/infra/database/models/doc-usage.ts` (create) | `DocUsage` model, one row per live document |
| `src/infra/database/models/index.ts` (modify) | export `DocUsage` |
| `src/domain/limit/docUsage.ts` (create) | hot path: cutoff resolution, per-document refresh, portal total, safe wrapper |
| `src/domain/limit/rebuildPortalUsage.ts` (create) | bulk per-portal rebuild used by the script and future cutoff changes |
| `src/domain/limit/index.ts` (modify) | export the new functions |
| `src/domain/file/create.ts` (modify) | replace `$inc` with a refresh |
| `src/domain/file/deleteByIpfsHashes.ts` (modify) | replace `$inc` with a refresh, `bytesFreed` from before/after |
| `src/domain/file/deleteAll.ts` (modify) | add a refresh |
| `scripts/rebuild-doc-usage.ts` (create) | migration and reconcile script, dry-run by default |

---

### Task 1: Config, models, and index

**Files:**
- Modify: `src/config/index.ts`
- Modify: `src/config/.env.example`
- Modify: `src/infra/database/models/limit.ts:18-43`
- Modify: `src/infra/database/models/file.ts:51-58`
- Create: `src/infra/database/models/doc-usage.ts`
- Modify: `src/infra/database/models/index.ts`

**Interfaces:**
- Produces: `config.STORAGE_VERSION_CUTOFF` (string, default `"5"`); `Limit` schema field `versionCutoff: number | null`; `DocUsage` model with fields `contractAddress, appFileId, fileId, latestFileSize, countedVersions, latestTimeStamp, charge, cutoff, updatedAt`; compound index on `files`.

- [ ] **Step 1: Add the config default**

In `src/config/index.ts`, after the `IDENTITY_INDEXER_TIMEOUT_MS` line and before `export { config };`, add:

```ts
config.STORAGE_VERSION_CUTOFF = config.STORAGE_VERSION_CUTOFF || "5";
```

- [ ] **Step 2: Document the variable**

In `src/config/.env.example`, add a line directly after `DEFAULT_STORAGE_LIMIT`:

```
STORAGE_VERSION_CUTOFF
```

- [ ] **Step 3: Add `versionCutoff` to the limit schema**

In `src/infra/database/models/limit.ts`, inside `limitSchema`, add after the `extendableStorage` block (after line 33):

```ts
  versionCutoff: {
    type: Number,
    default: null,
  },
```

- [ ] **Step 4: Add the compound index to the file schema**

In `src/infra/database/models/file.ts`, after the `fileSchema.pre("save", ...)` block and before `const File = model(...)`, add:

```ts
fileSchema.index({
  contractAddress: 1,
  appFileId: 1,
  ipfsType: 1,
  isDeleted: 1,
  timeStamp: -1,
});
```

- [ ] **Step 5: Create the DocUsage model**

Create `src/infra/database/models/doc-usage.ts`:

```ts
import { Schema, model } from "mongoose";

const docUsageSchema = new Schema({
  contractAddress: {
    type: String,
    lowercase: true,
    required: true,
  },
  appFileId: {
    type: String,
    default: null,
  },
  // Set only for content rows that have no appFileId, so each such row is its
  // own document instead of all of them collapsing onto the null key.
  fileId: {
    type: Schema.Types.ObjectId,
    default: null,
  },
  latestFileSize: { type: Number, required: true },
  countedVersions: { type: Number, required: true },
  latestTimeStamp: { type: Number, required: true },
  charge: { type: Number, required: true },
  cutoff: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});

docUsageSchema.index(
  { contractAddress: 1, appFileId: 1, fileId: 1 },
  { unique: true }
);

const DocUsage = model("doc-usages", docUsageSchema);

export default DocUsage;
```

- [ ] **Step 6: Export the model**

In `src/infra/database/models/index.ts`, add the import after the `Feedback` import and the name to the export list:

```ts
import DocUsage from "./doc-usage";
```

```ts
export {
  File,
  Limit,
  CommunityFiles,
  LegacyPortalLimit,
  Floppy,
  UserOps,
  ApiAccessKey,
  Workspace,
  Feedback,
  DocUsage,
};
```

- [ ] **Step 7: Gate**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/config/index.ts src/infra/database/models/limit.ts src/infra/database/models/file.ts src/infra/database/models/doc-usage.ts src/infra/database/models/index.ts`
Expected: no output.

---

### Task 2: Hot-path domain functions

**Files:**
- Create: `src/domain/limit/docUsage.ts`
- Modify: `src/domain/limit/index.ts`

**Interfaces:**
- Consumes: `DocUsage`, `File`, `Limit` from `src/infra/database/models`; `config.STORAGE_VERSION_CUTOFF`; `logger` from `src/infra/logger`.
- Produces:
  - `type DocKey = { appFileId: string } | { fileId: Types.ObjectId }`
  - `getVersionCutoff({ contractAddress }): Promise<number>`
  - `computeDocUsage({ contractAddress, key, cutoff }): Promise<number>` (returns the new charge, 0 if the document has no live content rows)
  - `computeStorageUse({ contractAddress }): Promise<number>` (returns the total it wrote)
  - `refreshUsage({ contractAddress, keys }): Promise<{ before: number; after: number }>`
  - `refreshUsageQuietly({ contractAddress, keys }, context): Promise<{ before: number; after: number } | null>`
  - `docKeyForRow(row): DocKey` where `row` has `_id` and optional `appFileId`

- [ ] **Step 1: Create the module**

Create `src/domain/limit/docUsage.ts`:

```ts
import { Types } from "mongoose";
import { config } from "../../config";
import { DocUsage, File, Limit } from "../../infra/database/models";
import { logger } from "../../infra/logger";
import { FileIPFSType } from "../../types";

export type DocKey = { appFileId: string } | { fileId: Types.ObjectId };

const DEFAULT_CUTOFF = 5;
const DUPLICATE_KEY = 11000;

const parseCutoff = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const docKeyForRow = (row: {
  _id: Types.ObjectId;
  appFileId?: string | null;
}): DocKey => (row.appFileId ? { appFileId: row.appFileId } : { fileId: row._id });

const docKeyFilter = (contractAddress: string, key: DocKey) =>
  "appFileId" in key
    ? { contractAddress, appFileId: key.appFileId, fileId: null }
    : { contractAddress, appFileId: null, fileId: key.fileId };

export const getVersionCutoff = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<number> => {
  const limit = await Limit.findOne({ contractAddress }).select("versionCutoff");
  return (
    parseCutoff(limit?.versionCutoff) ??
    parseCutoff(config.STORAGE_VERSION_CUTOFF) ??
    DEFAULT_CUTOFF
  );
};

const upsertDocUsage = async (
  filter: ReturnType<typeof docKeyFilter>,
  fields: {
    latestFileSize: number;
    countedVersions: number;
    latestTimeStamp: number;
    cutoff: number;
  }
) => {
  const update = {
    $set: {
      ...fields,
      charge: fields.latestFileSize * fields.countedVersions,
      updatedAt: Date.now(),
    },
  };
  try {
    await DocUsage.updateOne(filter, update, { upsert: true });
  } catch (err) {
    // Two writes for the same document can race to insert the row; the
    // second attempt is a plain update because the row now exists.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    await DocUsage.updateOne(filter, update, { upsert: true });
  }
  return update.$set.charge;
};

export const computeDocUsage = async ({
  contractAddress,
  key,
  cutoff,
}: {
  contractAddress: string;
  key: DocKey;
  cutoff: number;
}): Promise<number> => {
  const portal = contractAddress.toLowerCase();
  const filter = docKeyFilter(portal, key);

  if ("fileId" in key) {
    const row = await File.findOne({
      _id: key.fileId,
      contractAddress: portal,
      ipfsType: FileIPFSType.CONTENT,
      isDeleted: false,
    }).select("fileSize timeStamp");
    if (!row) {
      await DocUsage.deleteOne(filter);
      return 0;
    }
    return upsertDocUsage(filter, {
      latestFileSize: row.fileSize || 0,
      countedVersions: 1,
      latestTimeStamp: row.timeStamp,
      cutoff,
    });
  }

  const rows = await File.find({
    contractAddress: portal,
    appFileId: key.appFileId,
    ipfsType: FileIPFSType.CONTENT,
    isDeleted: false,
  })
    .sort({ timeStamp: -1 })
    .limit(cutoff)
    .select("fileSize timeStamp");

  if (rows.length === 0) {
    await DocUsage.deleteOne(filter);
    return 0;
  }

  return upsertDocUsage(filter, {
    latestFileSize: rows[0].fileSize || 0,
    countedVersions: rows.length,
    latestTimeStamp: rows[0].timeStamp,
    cutoff,
  });
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

const readStorageUse = async (contractAddress: string): Promise<number> => {
  const limit = await Limit.findOne({ contractAddress }).select("storageUse");
  return limit?.storageUse ? Number(limit.storageUse) : 0;
};

export const refreshUsage = async ({
  contractAddress,
  keys,
}: {
  contractAddress: string;
  keys: DocKey[];
}): Promise<{ before: number; after: number }> => {
  const portal = contractAddress.toLowerCase();
  const before = await readStorageUse(portal);
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  for (const key of keys) {
    await computeDocUsage({ contractAddress: portal, key, cutoff });
  }
  const after = await computeStorageUse({ contractAddress: portal });
  return { before, after };
};

export const refreshUsageQuietly = async (
  params: { contractAddress: string; keys: DocKey[] },
  context: Record<string, unknown>
): Promise<{ before: number; after: number } | null> => {
  try {
    return await refreshUsage(params);
  } catch (err) {
    logger.error(
      { ...context, contractAddress: params.contractAddress, err },
      "storage usage refresh failed; row write already committed"
    );
    return null;
  }
};
```

- [ ] **Step 2: Export from the limit domain index**

Replace the contents of `src/domain/limit/index.ts` with:

```ts
export { getStorageStatus } from "./getStorageStatus";
export { getStorageUse } from "./getStorageUse";
export { getLegacyStorageUse } from "./getLegacyStorageUse";
export { extendStorage } from "./extendStorage";
export { addStorage, STORAGE_ALREADY_ADDED_MESSAGE } from "./addStorage";
export {
  getVersionCutoff,
  computeDocUsage,
  computeStorageUse,
  refreshUsage,
  refreshUsageQuietly,
  docKeyForRow,
} from "./docUsage";
export type { DocKey } from "./docUsage";
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit`
Expected: no output. If mongoose's inferred document type rejects `row.fileSize` or `row.timeStamp`, the fix is to keep the `.select("fileSize timeStamp")` and read through `Number(row.get("fileSize"))`; do not add `any`.

Run: `npx eslint src/domain/limit/docUsage.ts src/domain/limit/index.ts`
Expected: no output.

---

### Task 3: Per-portal bulk rebuild

**Files:**
- Create: `src/domain/limit/rebuildPortalUsage.ts`
- Modify: `src/domain/limit/index.ts`

**Interfaces:**
- Consumes: `getVersionCutoff`, `computeStorageUse` from `./docUsage`; `DocUsage`, `File`, `Limit` models.
- Produces:
  - `type PortalDocUsage = { appFileId: string | null; fileId: Types.ObjectId | null; latestFileSize: number; countedVersions: number; latestTimeStamp: number; charge: number }`
  - `computePortalDocUsages({ contractAddress, cutoff }): Promise<PortalDocUsage[]>` (read-only)
  - `rebuildPortalUsage({ contractAddress }): Promise<{ docs: number; before: number; after: number }>`

- [ ] **Step 1: Create the module**

Create `src/domain/limit/rebuildPortalUsage.ts`:

```ts
import { Types } from "mongoose";
import { DocUsage, File, Limit } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import { computeStorageUse, getVersionCutoff } from "./docUsage";

export interface PortalDocUsage {
  appFileId: string | null;
  fileId: Types.ObjectId | null;
  latestFileSize: number;
  countedVersions: number;
  latestTimeStamp: number;
  charge: number;
}

// Mirrors docKeyForRow: missing, null, and empty appFileId all mean "none".
const hasNoAppFileId = {
  $or: [
    { $in: [{ $type: "$appFileId" }, ["missing", "null"]] },
    { $eq: ["$appFileId", ""] },
  ],
};

export const computePortalDocUsages = async ({
  contractAddress,
  cutoff,
}: {
  contractAddress: string;
  cutoff: number;
}): Promise<PortalDocUsage[]> => {
  const portal = contractAddress.toLowerCase();
  const groups: {
    _id: { appFileId: string | null; fileId: Types.ObjectId | null };
    sizes: number[];
    latestTimeStamp: number;
  }[] = await File.aggregate([
    {
      $match: {
        contractAddress: portal,
        ipfsType: FileIPFSType.CONTENT,
        isDeleted: false,
      },
    },
    { $sort: { timeStamp: -1 } },
    {
      $group: {
        _id: {
          appFileId: { $cond: [hasNoAppFileId, null, "$appFileId"] },
          fileId: { $cond: [hasNoAppFileId, "$_id", null] },
        },
        sizes: { $push: { $ifNull: ["$fileSize", 0] } },
        latestTimeStamp: { $first: "$timeStamp" },
      },
    },
    { $project: { sizes: { $slice: ["$sizes", cutoff] }, latestTimeStamp: 1 } },
  ]).allowDiskUse(true);

  return groups.map((g) => ({
    appFileId: g._id.appFileId,
    fileId: g._id.fileId,
    latestFileSize: g.sizes[0],
    countedVersions: g.sizes.length,
    latestTimeStamp: g.latestTimeStamp,
    charge: g.sizes[0] * g.sizes.length,
  }));
};

export const rebuildPortalUsage = async ({
  contractAddress,
}: {
  contractAddress: string;
}): Promise<{ docs: number; before: number; after: number }> => {
  const portal = contractAddress.toLowerCase();
  const startedAt = Date.now();
  const limit = await Limit.findOne({ contractAddress: portal }).select(
    "storageUse"
  );
  const before = limit?.storageUse ? Number(limit.storageUse) : 0;
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({ contractAddress: portal, cutoff });

  if (docs.length > 0) {
    await DocUsage.bulkWrite(
      docs.map((d) => ({
        updateOne: {
          filter: { contractAddress: portal, appFileId: d.appFileId, fileId: d.fileId },
          update: {
            $set: {
              latestFileSize: d.latestFileSize,
              countedVersions: d.countedVersions,
              latestTimeStamp: d.latestTimeStamp,
              charge: d.charge,
              cutoff,
              updatedAt: Date.now(),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
  }

  // Rows the rebuild did not touch belong to documents with no live content.
  await DocUsage.deleteMany({
    contractAddress: portal,
    updatedAt: { $lt: startedAt },
  });

  const after = await computeStorageUse({ contractAddress: portal });
  return { docs: docs.length, before, after };
};
```

- [ ] **Step 2: Export**

Append to `src/domain/limit/index.ts`:

```ts
export {
  computePortalDocUsages,
  rebuildPortalUsage,
} from "./rebuildPortalUsage";
export type { PortalDocUsage } from "./rebuildPortalUsage";
```

- [ ] **Step 3: Gate**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/domain/limit/rebuildPortalUsage.ts src/domain/limit/index.ts`
Expected: no output.

---

### Task 4: Wire the three write sites

**Files:**
- Modify: `src/domain/file/create.ts:1-2,61-72`
- Modify: `src/domain/file/deleteByIpfsHashes.ts`
- Modify: `src/domain/file/deleteAll.ts`

**Interfaces:**
- Consumes: `refreshUsageQuietly`, `docKeyForRow`, `DocKey` from `../limit/docUsage`.
- Produces: `deleteByIpfsHashes` still returns `{ deletedCount, bytesFreed }`; `deleteAll` still returns the `updateMany` result.

- [ ] **Step 1: Replace the increment in `create`**

In `src/domain/file/create.ts`, change the imports at the top to:

```ts
import { config } from "../../config";
import { File } from "../../infra/database/models";
import { FileIPFSType, IFile } from "../../types";
import { docKeyForRow, refreshUsageQuietly } from "../limit/docUsage";
```

Replace lines 61 to 71 (the `// People are hitting ceiling too fast` comment through the closing brace of the `if` block) with:

```ts
  if (newFile.ipfsType === FileIPFSType.CONTENT) {
    await refreshUsageQuietly(
      { contractAddress, keys: [docKeyForRow(newFile)] },
      { appFileId: params.appFileId, ipfsHash: newFile.ipfsHash }
    );
  }
```

The `Limit` import is removed because nothing in the file uses it any more.

- [ ] **Step 2: Replace the decrement in `deleteByIpfsHashes`**

Replace the whole of `src/domain/file/deleteByIpfsHashes.ts` with:

```ts
import { File } from "../../infra/database/models";
import { FileIPFSType } from "../../types";
import { DocKey, docKeyForRow, refreshUsageQuietly } from "../limit/docUsage";

interface IDeleteByIpfsHashesParams {
  contractAddress: string;
  ipfsHashes: string[];
}

export const deleteByIpfsHashes = async ({
  contractAddress,
  ipfsHashes,
}: IDeleteByIpfsHashesParams) => {
  const portal = contractAddress.toLowerCase();
  const matchedFiles = await File.find({
    ipfsHash: { $in: ipfsHashes },
    contractAddress: portal,
    isDeleted: false,
  });

  if (matchedFiles.length === 0) {
    return { deletedCount: 0, bytesFreed: 0 };
  }

  const fileIds = matchedFiles.map((f) => f._id);
  await File.updateMany(
    { _id: { $in: fileIds } },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );

  const keys = new Map<string, DocKey>();
  for (const f of matchedFiles) {
    if (f.ipfsType !== FileIPFSType.CONTENT) continue;
    const key = docKeyForRow(f);
    keys.set("appFileId" in key ? `a:${key.appFileId}` : `f:${key.fileId}`, key);
  }

  let bytesFreed = 0;
  if (keys.size > 0) {
    const result = await refreshUsageQuietly(
      { contractAddress: portal, keys: [...keys.values()] },
      { ipfsHashes }
    );
    if (result) bytesFreed = Math.max(0, result.before - result.after);
  }

  return { deletedCount: matchedFiles.length, bytesFreed };
};
```

- [ ] **Step 3: Add the refresh to `deleteAll`**

Replace the whole of `src/domain/file/deleteAll.ts` with:

```ts
import { File } from "../../infra/database/models";
import { getCommunityFile } from "../communityFiles";
import { deleteCommunityFile } from "../communityFiles/delete";
import { refreshUsageQuietly } from "../limit/docUsage";

interface IDeleteAllCriteria {
  appFileId: string;
  contractAddress: string;
}

export const deleteAll = async (criteria: IDeleteAllCriteria) => {
  const existingCommunityFile = await getCommunityFile({
    dsheetId: criteria.appFileId,
    contractAddress: criteria.contractAddress,
  });

  if (existingCommunityFile) {
    await deleteCommunityFile({
      appFileId: criteria.appFileId,
      contractAddress: criteria.contractAddress,
    });
  }

  const result = await File.updateMany(
    { ...criteria, isDeleted: false },
    { $set: { isDeleted: true, markedForUnpin: true } }
  );

  if (result.modifiedCount > 0) {
    await refreshUsageQuietly(
      {
        contractAddress: criteria.contractAddress,
        keys: [{ appFileId: criteria.appFileId }],
      },
      { appFileId: criteria.appFileId }
    );
  }

  return result;
};
```

- [ ] **Step 4: Confirm nothing else touches `storageUse` with `$inc`**

Run: `grep -rn "storageUse" src --include=*.ts | grep "\$inc"`
Expected: no output.

- [ ] **Step 5: Gate**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint src/domain/file/create.ts src/domain/file/deleteByIpfsHashes.ts src/domain/file/deleteAll.ts`
Expected: no output.

---

### Task 5: Rebuild and migration script

**Files:**
- Create: `scripts/rebuild-doc-usage.ts`

**Interfaces:**
- Consumes: `computePortalDocUsages`, `rebuildPortalUsage`, `getVersionCutoff` from `../src/domain/limit`; `File`, `Limit`, `DocUsage` models.
- Produces: CLI `npx ts-node scripts/rebuild-doc-usage.ts [--apply] [--portal <address>]`.

- [ ] **Step 1: Create the script**

Create `scripts/rebuild-doc-usage.ts`:

```ts
import "../src/infra/database";
import mongoose from "mongoose";
import { DocUsage, File, Limit } from "../src/infra/database/models";
import {
  computePortalDocUsages,
  getVersionCutoff,
  rebuildPortalUsage,
} from "../src/domain/limit";
import { FileIPFSType } from "../src/types";

// Usage: npx ts-node scripts/rebuild-doc-usage.ts [--apply] [--portal <address>]
//
// Rebuilds doc-usages and limits.storageUse from the files collection. Dry-run
// by default: prints what would change and writes nothing. Safe to re-run.

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const portalArgIndex = args.indexOf("--portal");
const onlyPortal =
  portalArgIndex >= 0 ? args[portalArgIndex + 1]?.toLowerCase() : undefined;

if (portalArgIndex >= 0 && !/^0x[0-9a-f]{40}$/.test(onlyPortal ?? "")) {
  console.error("--portal expects a 0x address");
  process.exit(1);
}

const toGB = (v: number) => `${(v / 1e9).toFixed(3)} GB`;

const liveContent = { ipfsType: FileIPFSType.CONTENT, isDeleted: false };

async function preChecks() {
  const [noFileSize, noAppFileId, noIpfsType] = await Promise.all([
    File.countDocuments({ ...liveContent, fileSize: null }),
    File.countDocuments({ ...liveContent, appFileId: { $in: [null, ""] } }),
    File.countDocuments({ isDeleted: false, ipfsType: null }),
  ]);
  console.log("Pre-checks (live rows):");
  console.log(`  content rows with no fileSize:  ${noFileSize}`);
  console.log(`  content rows with no appFileId: ${noAppFileId}`);
  console.log(`  rows with no ipfsType:          ${noIpfsType}`);
}

async function listPortals(): Promise<string[]> {
  if (onlyPortal) return [onlyPortal];
  const portals: string[] = await File.distinct("contractAddress", liveContent);
  return portals.filter(Boolean).map((p) => p.toLowerCase());
}

async function dryRunPortal(portal: string) {
  const limit = await Limit.findOne({ contractAddress: portal }).select("storageUse");
  const before = limit?.storageUse ? Number(limit.storageUse) : 0;
  const cutoff = await getVersionCutoff({ contractAddress: portal });
  const docs = await computePortalDocUsages({ contractAddress: portal, cutoff });
  const after = docs.reduce((sum, d) => sum + d.charge, 0);
  return { docs: docs.length, before, after };
}

async function orphanedLimits(portalsWithContent: Set<string>) {
  const rows = await Limit.find({ storageUse: { $ne: 0 } }).select(
    "contractAddress storageUse"
  );
  return rows.filter(
    (r) =>
      r.contractAddress &&
      !portalsWithContent.has(r.contractAddress) &&
      (!onlyPortal || r.contractAddress === onlyPortal)
  );
}

async function main() {
  console.log(apply ? "MODE: apply" : "MODE: dry-run (pass --apply to write)");
  await preChecks();

  const portals = await listPortals();
  console.log(`\nPortals with live content: ${portals.length}`);

  const movers: { portal: string; docs: number; before: number; after: number }[] =
    [];
  for (const portal of portals) {
    const r = apply
      ? await rebuildPortalUsage({ contractAddress: portal })
      : await dryRunPortal(portal);
    movers.push({ portal, ...r });
  }

  const orphans = await orphanedLimits(new Set(portals));
  if (apply && orphans.length > 0) {
    await Limit.updateMany(
      { _id: { $in: orphans.map((o) => o._id) } },
      { $set: { storageUse: 0 } }
    );
  }
  if (apply && !onlyPortal) {
    await DocUsage.deleteMany({ contractAddress: { $nin: portals } });
  }
  console.log(
    `Limits rows with non-zero storageUse and no live content: ${orphans.length}` +
      (apply ? " (set to 0)" : " (would be set to 0)")
  );

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
  console.log(`\nTotal across portals: ${toGB(totalBefore)} -> ${toGB(totalAfter)}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("ERROR:", err?.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Gate**

The script is outside `tsconfig.json`'s `include`, so type-check it explicitly:

Run: `npx tsc --noEmit --strict --esModuleInterop --resolveJsonModule --skipLibCheck --target ES2020 --module commonjs --moduleResolution node scripts/rebuild-doc-usage.ts`
Expected: no output.

Run: `npx eslint scripts/rebuild-doc-usage.ts`
Expected: no output.

---

### Task 6: Diff hygiene

**Files:** none new.

- [ ] **Step 1: Doc references**

Run: `git diff | grep -n "docs/\|spec section"` and `git status --short`
Expected: no hits in any added line. If there are, remove the pointer and keep the reason.

- [ ] **Step 2: Em dashes and dynamic imports in new code**

Run: `git diff -U0 | grep -n "^+" | grep -n "—\|import("`
Expected: no output.

- [ ] **Step 3: Full gate**

Run: `npx tsc --noEmit && npx eslint src/domain/limit src/domain/file src/infra/database/models src/config scripts/rebuild-doc-usage.ts`
Expected: no output.

- [ ] **Step 4: Stop for review**

Do not commit. Report the list of changed and created files to Nadeem.

---

### Task 7: Manual verification on staging (Nadeem or on request)

This task is run against the staging app `sepolia-dsheet-storage` after deploy. It is recorded here so the smoke steps are exact; none of it is executed by the implementer without being asked.

- [ ] **Step 1: Confirm the index built**

In a read-only mongosh session against staging:

```js
db.files.getIndexes().map((i) => i.name)
```

Expected: includes `contractAddress_1_appFileId_1_ipfsType_1_isDeleted_1_timeStamp_-1`.

- [ ] **Step 2: Dry-run the rebuild**

```bash
npx ts-node scripts/rebuild-doc-usage.ts
```

Expected: pre-check counts, portal count, movers lists, and totals, with no writes. Review the increases list; each should be a portal with few versions per doc that grew.

- [ ] **Step 3: Apply**

```bash
npx ts-node scripts/rebuild-doc-usage.ts --apply
```

Expected: same shape of output with `MODE: apply`. Re-running immediately prints identical before and after values per portal.

- [ ] **Step 4: New document**

In the staging app, create and publish a new document on a test portal. Then:

```js
db["doc-usages"].find({ contractAddress: "<portal>", appFileId: "<ddocId>" }).toArray()
```

Expected: one row, `countedVersions: 1`, `charge` equal to `latestFileSize`, `cutoff: 5`.

- [ ] **Step 5: Six republishes**

Edit and publish the same document six times, then repeat the query.

Expected: `countedVersions: 5`, `latestFileSize` equal to the newest content row's `fileSize`, `charge = latestFileSize * 5`. And:

```js
db.limits.findOne({ contractAddress: "<portal>" }).storageUse
```

Expected: equals the sum of `charge` over the portal's doc-usages rows.

- [ ] **Step 6: Delete through the app**

Delete the document in the app and wait for the indexer webhook (up to a couple of minutes). Repeat both queries.

Expected: the doc-usages row is gone and `storageUse` dropped by the previous `charge`.

- [ ] **Step 7: Delete through the direct route**

Publish another document, then call the storage service's `DELETE /file/<appFileId>` with the usual `contract` and auth headers. Repeat both queries.

Expected: same outcome as step 6, which is new behaviour for this route.

- [ ] **Step 8: Per-portal cutoff**

Set `versionCutoff: 2` on the test portal's limits row, then run:

```bash
npx ts-node scripts/rebuild-doc-usage.ts --apply --portal <portal>
```

Expected: the six-times-published document's row now shows `countedVersions: 2`, `cutoff: 2`, and `storageUse` shrank accordingly. Unset the field and rebuild again to restore.
