# Storage Usage Debug View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only endpoint in storage-v2 and an unlinked page in ddocs.new that show, per portal and per document, the stored accounting rows next to a live recompute, for testing the storage-usage redesign.

**Architecture:** `GET /limit/usage-by-doc` reuses the redesign's domain code (`sumDocCharges`, `getVersionCutoff`, `computePortalDocUsages`) and writes nothing. The page `app/dev/storage/page.tsx` fetches it with the same auth the sidebar's storage bar uses, resolves titles from the local Dexie store, and renders one card per portal. A code constant gates the page.

**Tech Stack:** storage-v2: Express, express-validation Joi, mongoose 6, TypeScript strict. ddocs.new: Next.js app router client page, React Query, Dexie, `@fileverse/ui`, Tailwind.

Spec: `docs/superpowers/specs/2026-09-19-storage-usage-debug-design.md` (storage-v2).

## Global Constraints

- No commits, no git state changes, no npm install, no scripts against a database, no server or app start. Gates: storage-v2 `npx tsc --noEmit`; ddocs.new `npx tsc --noEmit` (the repo's usual gate) plus `npx eslint` on the two touched files if eslint runs there.
- No code comments that reference docs, specs, plans or task numbers. Minimal comments. No em dashes. No dynamic `import()`. No `any`, `@ts-ignore`, `as any`. No unit tests.
- Style storage-v2: prettier defaults, double quotes, semicolons, 2-space, trailing commas, 80 columns, trailing newline. Style ddocs.new: prettier per `.prettierrc` (single quotes, semicolons, 2-space, trailing commas es5), 80 columns, trailing newline.
- Nothing on either side writes to the database or to app state.
- The page is gated by `const STORAGE_DEBUG_PAGE = true;` at the top of the page file; `false` renders `notFound()`.

---

### Task 1: Server endpoint `GET /limit/usage-by-doc` (storage-v2)

**Files:**
- Modify: `src/domain/limit/docUsage.ts` (export the row-sum helper)
- Create: `src/domain/limit/getUsageByDoc.ts`
- Modify: `src/domain/limit/index.ts` (barrel exports)
- Create: `src/interface/limit/usageByDoc.ts`
- Modify: `src/interface/limit/index.ts` (route)

**Interfaces:**
- Consumes: `getVersionCutoff`, `sumDocCharges` from `./docUsage`; `computePortalDocUsages` from `./rebuildPortalUsage`; `isLegacyContract` from `src/domain/contract`; `canCheckLimitUse` middleware; `validate`, `Joi` from `src/interface/middleware`.
- Produces: `getUsageByDoc({ contractAddress, live }): Promise<PortalUsageByDoc>`, `legacyPortalUsage(contractAddress): PortalUsageByDoc`, types `PortalUsageByDoc`, `StoredDocUsage`, `LiveDocUsage`; the response shape in spec section 2, consumed by Task 2.

- [ ] **Step 1: Export the row-sum helper**

In `src/domain/limit/docUsage.ts`, rename the module-private `sumCharges` to an exported `sumDocCharges` and update its one call site inside `computeStorageUse`:

```ts
export const sumDocCharges = async (portal: string): Promise<number> => {
  const [agg] = await DocUsage.aggregate([
    { $match: { contractAddress: portal } },
    { $group: { _id: null, total: { $sum: "$charge" } } },
  ]);
  return agg?.total ?? 0;
};
```

and in `computeStorageUse`: `total = await sumDocCharges(portal);`

- [ ] **Step 2: Domain function**

Create `src/domain/limit/getUsageByDoc.ts`:

```ts
import { DocUsage, Limit } from "../../infra/database/models";
import { getVersionCutoff, sumDocCharges } from "./docUsage";
import { computePortalDocUsages } from "./rebuildPortalUsage";

const MAX_DOCS = 500;

export interface StoredDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
  dirty: boolean;
  summed: boolean;
  attempts: number;
  lastError: string | null;
  updatedAt: number;
}

export interface LiveDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
}

export interface DocUsageEntry {
  appFileId: string;
  stored: StoredDocUsage | null;
  live: LiveDocUsage | null;
}

export interface PortalUsageByDoc {
  contractAddress: string;
  legacy: boolean;
  cutoff: number;
  storageUse: number;
  rowSum: number;
  liveSum: number | null;
  usageDirty: boolean;
  dirtyRows: number;
  unsummedRows: number;
  truncated: boolean;
  docs: DocUsageEntry[];
}

export const legacyPortalUsage = (
  contractAddress: string
): PortalUsageByDoc => ({
  contractAddress: contractAddress.toLowerCase(),
  legacy: true,
  cutoff: 0,
  storageUse: 0,
  rowSum: 0,
  liveSum: null,
  usageDirty: false,
  dirtyRows: 0,
  unsummedRows: 0,
  truncated: false,
  docs: [],
});

const weight = (entry: DocUsageEntry): number =>
  Math.max(entry.stored?.charge ?? 0, entry.live?.charge ?? 0);

export const getUsageByDoc = async ({
  contractAddress,
  live,
}: {
  contractAddress: string;
  live: boolean;
}): Promise<PortalUsageByDoc> => {
  const portal = contractAddress.toLowerCase();
  const [limit, rows, rowSum, dirtyRows, unsummedRows, cutoff] =
    await Promise.all([
      Limit.findOne({ contractAddress: portal }).select(
        "storageUse usageDirty"
      ),
      DocUsage.find({ contractAddress: portal })
        .sort({ charge: -1 })
        .limit(MAX_DOCS)
        .lean(),
      sumDocCharges(portal),
      DocUsage.countDocuments({ contractAddress: portal, dirty: true }),
      DocUsage.countDocuments({ contractAddress: portal, summed: false }),
      getVersionCutoff({ contractAddress: portal }),
    ]);
  const liveDocs = live
    ? await computePortalDocUsages({ contractAddress: portal, cutoff })
    : null;

  const byId = new Map<string, DocUsageEntry>();
  for (const row of rows) {
    byId.set(row.appFileId, {
      appFileId: row.appFileId,
      stored: {
        charge: row.charge,
        countedVersions: row.countedVersions,
        latestFileSize: row.latestFileSize,
        latestTimeStamp: row.latestTimeStamp,
        dirty: row.dirty,
        summed: row.summed,
        attempts: row.attempts,
        lastError: row.lastError,
        updatedAt: row.updatedAt,
      },
      live: null,
    });
  }
  for (const doc of liveDocs ?? []) {
    const entry = byId.get(doc.appFileId) ?? {
      appFileId: doc.appFileId,
      stored: null,
      live: null,
    };
    entry.live = {
      charge: doc.charge,
      countedVersions: doc.countedVersions,
      latestFileSize: doc.latestFileSize,
      latestTimeStamp: doc.latestTimeStamp,
    };
    byId.set(doc.appFileId, entry);
  }
  const merged = [...byId.values()].sort((a, b) => weight(b) - weight(a));

  return {
    contractAddress: portal,
    legacy: false,
    cutoff,
    storageUse: limit?.storageUse ? Number(limit.storageUse) : 0,
    rowSum,
    liveSum: liveDocs
      ? liveDocs.reduce((sum, doc) => sum + doc.charge, 0)
      : null,
    usageDirty: Boolean(limit?.usageDirty),
    dirtyRows,
    unsummedRows,
    truncated: rows.length === MAX_DOCS || merged.length > MAX_DOCS,
    docs: merged.slice(0, MAX_DOCS),
  };
};
```

- [ ] **Step 3: Barrel**

In `src/domain/limit/index.ts` add `sumDocCharges` to the `./docUsage` export list, and append:

```ts
export { getUsageByDoc, legacyPortalUsage } from "./getUsageByDoc";
export type {
  DocUsageEntry,
  LiveDocUsage,
  PortalUsageByDoc,
  StoredDocUsage,
} from "./getUsageByDoc";
```

- [ ] **Step 4: Handler**

Create `src/interface/limit/usageByDoc.ts`:

```ts
import { Response } from "express";
import { Hex } from "viem";
import { getUsageByDoc, legacyPortalUsage } from "../../domain/limit";
import { isLegacyContract } from "../../domain/contract";
import { validate, Joi } from "../middleware";
import { CustomRequest } from "../../types";
import { throwError } from "../../infra/errorHandler";

const usageByDocValidation = {
  headers: Joi.object({
    contract: Joi.string().required(),
    invoker: Joi.string().required(),
    chain: Joi.string().required(),
  }).unknown(true),
  query: Joi.object({
    live: Joi.string().valid("1").optional(),
  }).unknown(true),
};

async function usageByDoc(req: CustomRequest, res: Response) {
  const { contractAddresses } = req;
  if (!contractAddresses || contractAddresses.length === 0) {
    return throwError({ code: 400, message: "Invalid request", req });
  }
  const live = req.query.live === "1";
  const portals = [];
  for (const contractAddress of contractAddresses) {
    const isLegacy = await isLegacyContract(contractAddress as Hex);
    portals.push(
      isLegacy
        ? legacyPortalUsage(contractAddress)
        : await getUsageByDoc({ contractAddress, live })
    );
  }
  res.json({ portals });
}

export default [validate(usageByDocValidation), usageByDoc];
```

- [ ] **Step 5: Route**

In `src/interface/limit/index.ts` add `import usageByDoc from "./usageByDoc";` next to the other handler imports and, after the `/use` line:

```ts
router.get(
  "/usage-by-doc",
  asyncHandler(canCheckLimitUse),
  asyncHandlerArray(usageByDoc)
);
```

- [ ] **Step 6: Gate**

Run: `npx tsc --noEmit`
Expected: no output.

---

### Task 2: Page `/dev/storage` (ddocs.new)

**Files:**
- Modify: `utils/get-storage.ts` (add `storageUsageByDocAPI`)
- Create: `app/dev/storage/page.tsx`

**Interfaces:**
- Consumes: the response shape from Task 1; `useKeystore`, `useAgent` from `@/stores/account-store`; `useActiveIdentityStatus` from `@/hooks/use-active-identity`; `NewKeystoreSlice` from `@/utils/identity-utils/keystore/types`; `CHAIN` from `@/utils/constants`; `db` from `@/db/db`; `generateAuthToken` from `@/utils/crypto-utils`; `Button` from `@fileverse/ui`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Fetch helper**

Append to `utils/get-storage.ts`:

```ts
export const storageUsageByDocAPI = async (request: Request) => {
  if (!request.editSecret) return null;
  const token = await generateAuthToken(
    request.primaryPortalAddress,
    request.editSecret || ''
  );
  const res = await axios.get(
    `${process.env.NEXT_PUBLIC_STORAGE_BACKEND}/limit/usage-by-doc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        contract: request.contractAddress,
        invoker: request.invoker || '',
        chain: request.chain,
      },
      params: { live: 1 },
    }
  );
  return res.data;
};
```

- [ ] **Step 2: Page**

Create `app/dev/storage/page.tsx`:

```tsx
'use client';

// /dev/storage: testing view for per-document storage accounting. Unlinked;
// reachable on the branch's Vercel preview URL. Reads only.

import { useEffect, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@fileverse/ui';
import { useAgent, useKeystore } from '@/stores/account-store';
import { useActiveIdentityStatus } from '@/hooks/use-active-identity';
import { NewKeystoreSlice } from '@/utils/identity-utils/keystore/types';
import { CHAIN } from '@/utils/constants';
import { db } from '@/db/db';
import { storageUsageByDocAPI } from '@/utils/get-storage';

// Flip by hand. If this page ever moves to staging, read an env var here.
const STORAGE_DEBUG_PAGE = true;

const LIVE_REFRESH_MS = 5000;

interface StoredDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
  dirty: boolean;
  summed: boolean;
  attempts: number;
  lastError: string | null;
  updatedAt: number;
}

interface LiveDocUsage {
  charge: number;
  countedVersions: number;
  latestFileSize: number;
  latestTimeStamp: number;
}

interface DocUsageEntry {
  appFileId: string;
  stored: StoredDocUsage | null;
  live: LiveDocUsage | null;
}

interface PortalUsageByDoc {
  contractAddress: string;
  legacy: boolean;
  cutoff: number;
  storageUse: number;
  rowSum: number;
  liveSum: number | null;
  usageDirty: boolean;
  dirtyRows: number;
  unsummedRows: number;
  truncated: boolean;
  docs: DocUsageEntry[];
}

interface UsageByDocResponse {
  portals: PortalUsageByDoc[];
}

const bytes = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const mb = value / 1e6;
  return `${value.toLocaleString()} (${mb.toFixed(2)} MB)`;
};

const shortId = (id: string): string =>
  id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

const ago = (ts: number | null | undefined): string => {
  if (!ts) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

const Badge = ({ label, tone }: { label: string; tone: 'warn' | 'bad' }) => (
  <span
    className={
      tone === 'bad'
        ? 'rounded px-1.5 py-0.5 text-[11px] bg-[#FB3449] text-white'
        : 'rounded px-1.5 py-0.5 text-[11px] bg-[#FFDF0A] text-black'
    }
  >
    {label}
  </span>
);

const Stat = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="flex flex-col">
    <span className="text-[11px] color-text-secondary">{label}</span>
    <span
      className={
        highlight ? 'text-[13px] font-semibold text-[#FB3449]' : 'text-[13px]'
      }
    >
      {value}
    </span>
  </div>
);

const PortalCard = ({
  portal,
  titles,
}: {
  portal: PortalUsageByDoc;
  titles: Map<string, string>;
}) => {
  if (portal.legacy) {
    return (
      <div className="rounded-lg border color-border-default p-4">
        <p className="text-[13px] font-mono">{portal.contractAddress}</p>
        <p className="text-[12px] color-text-secondary">
          Legacy portal, not accounted per document.
        </p>
      </div>
    );
  }
  const rowMismatch = portal.storageUse !== portal.rowSum;
  const liveMismatch =
    portal.liveSum !== null && portal.liveSum !== portal.rowSum;
  return (
    <div className="rounded-lg border color-border-default p-4 flex flex-col gap-3">
      <p className="text-[13px] font-mono break-all">
        {portal.contractAddress}
      </p>
      <div className="flex flex-wrap gap-6">
        <Stat label="limits.storageUse" value={bytes(portal.storageUse)} />
        <Stat
          label="sum of rows"
          value={bytes(portal.rowSum)}
          highlight={rowMismatch}
        />
        <Stat
          label="sum of live recompute"
          value={bytes(portal.liveSum)}
          highlight={liveMismatch}
        />
        <Stat label="cutoff" value={String(portal.cutoff)} />
        <Stat
          label="usageDirty"
          value={String(portal.usageDirty)}
          highlight={portal.usageDirty}
        />
        <Stat
          label="dirty rows"
          value={String(portal.dirtyRows)}
          highlight={portal.dirtyRows > 0}
        />
        <Stat
          label="unsummed rows"
          value={String(portal.unsummedRows)}
          highlight={portal.unsummedRows > 0}
        />
        {portal.truncated && <Stat label="list" value="truncated to 500" />}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left color-text-secondary">
              <th className="pr-3 py-1">Title</th>
              <th className="pr-3 py-1">Id</th>
              <th className="pr-3 py-1">Stored charge</th>
              <th className="pr-3 py-1">Live charge</th>
              <th className="pr-3 py-1">Delta</th>
              <th className="pr-3 py-1">Versions</th>
              <th className="pr-3 py-1">Latest size</th>
              <th className="pr-3 py-1">State</th>
              <th className="pr-3 py-1">Updated</th>
            </tr>
          </thead>
          <tbody>
            {portal.docs.map((doc) => {
              const stored = doc.stored?.charge ?? null;
              const live = doc.live?.charge ?? null;
              const delta =
                stored !== null && live !== null ? live - stored : null;
              return (
                <tr
                  key={doc.appFileId}
                  className="border-t color-border-default align-top"
                >
                  <td className="pr-3 py-1 max-w-[240px] truncate">
                    {titles.get(doc.appFileId) ?? '(no local title)'}
                  </td>
                  <td className="pr-3 py-1 font-mono" title={doc.appFileId}>
                    {shortId(doc.appFileId)}
                  </td>
                  <td className="pr-3 py-1">{bytes(stored)}</td>
                  <td className="pr-3 py-1">{bytes(live)}</td>
                  <td
                    className={
                      delta ? 'pr-3 py-1 font-semibold text-[#FB3449]' : 'pr-3 py-1'
                    }
                  >
                    {delta === null ? '-' : delta.toLocaleString()}
                  </td>
                  <td className="pr-3 py-1">
                    {doc.stored?.countedVersions ?? '-'} /{' '}
                    {doc.live?.countedVersions ?? '-'}
                  </td>
                  <td className="pr-3 py-1">
                    {bytes(doc.live?.latestFileSize ?? doc.stored?.latestFileSize)}
                  </td>
                  <td className="pr-3 py-1 flex gap-1 flex-wrap">
                    {doc.stored === null && <Badge label="no row" tone="warn" />}
                    {doc.live === null && doc.stored !== null && (
                      <Badge label="no live content" tone="warn" />
                    )}
                    {doc.stored?.dirty && <Badge label="dirty" tone="warn" />}
                    {doc.stored && !doc.stored.summed && (
                      <Badge label="unsummed" tone="warn" />
                    )}
                    {doc.stored && doc.stored.attempts > 0 && (
                      <span title={doc.stored.lastError ?? ''}>
                        <Badge
                          label={`attempts ${doc.stored.attempts}`}
                          tone="bad"
                        />
                      </span>
                    )}
                  </td>
                  <td className="pr-3 py-1">{ago(doc.stored?.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function StorageDebugPage() {
  if (!STORAGE_DEBUG_PAGE) notFound();

  const status = useActiveIdentityStatus();
  const keyStoreState = useKeystore();
  const agent = useAgent();
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  const portalAddresses = useMemo(
    () => Array.from(keyStoreState?.slices.keys() ?? []),
    [keyStoreState]
  );

  const { data, isLoading, error, refetch, dataUpdatedAt } =
    useQuery<UsageByDocResponse | null>({
      queryKey: ['STORAGE_USAGE_BY_DOC', portalAddresses.join(',')],
      queryFn: async () => {
        const primaryPortalAddress = keyStoreState?.primaryAddress;
        if (!portalAddresses.length || !primaryPortalAddress || !agent) {
          return null;
        }
        const slice = keyStoreState?.slices.get(
          primaryPortalAddress
        ) as NewKeystoreSlice;
        return storageUsageByDocAPI({
          contractAddress: portalAddresses.join(','),
          primaryPortalAddress,
          editSecret: slice.ownerSecret,
          invoker: agent.getAgentAddress(),
          chain: CHAIN.id,
        });
      },
      enabled: status === 'ready',
      refetchInterval: liveRefresh ? LIVE_REFRESH_MS : false,
    });

  useEffect(() => {
    const ids = (data?.portals ?? []).flatMap((p) =>
      p.docs.map((d) => d.appFileId)
    );
    if (ids.length === 0) return;
    let cancelled = false;
    void db.ddocs.bulkGet(ids).then((docs) => {
      if (cancelled) return;
      const next = new Map<string, string>();
      docs.forEach((doc) => {
        if (doc?.ddocId && doc.title) next.set(doc.ddocId, doc.title);
      });
      setTitles(next);
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (status !== 'ready') {
    return (
      <div className="p-6 text-[13px]">Sign in to see storage usage.</div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-[1200px]">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[16px] font-semibold">Storage usage by document</h1>
        <Button size="sm" variant="ghost" onClick={() => void refetch()}>
          Refresh
        </Button>
        <Button
          size="sm"
          variant={liveRefresh ? 'default' : 'ghost'}
          onClick={() => setLiveRefresh((v) => !v)}
        >
          {liveRefresh ? 'Live refresh: on' : 'Live refresh: off'}
        </Button>
        <span className="text-[12px] color-text-secondary">
          {dataUpdatedAt ? `fetched ${ago(dataUpdatedAt)}` : ''}
        </span>
      </div>
      {isLoading && <p className="text-[13px]">Loading…</p>}
      {error && (
        <p className="text-[13px] text-[#FB3449]">
          {error instanceof Error ? error.message : 'Request failed'}
        </p>
      )}
      {data?.portals.map((portal) => (
        <PortalCard
          key={portal.contractAddress}
          portal={portal}
          titles={titles}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Gates**

Run in ddocs.new: `npx tsc --noEmit` and `npx eslint app/dev/storage/page.tsx utils/get-storage.ts`.
Expected: no errors. If prettier is available (`npx prettier --check` on the two files), it must pass; fix formatting to match rather than disabling rules.

---

### Task 3: Hygiene

- [ ] Grep both diffs for `docs/`, `spec section`, em dashes in new code lines (the ellipsis character in `shortId` and the loading text is fine), `import(`, `as any`, `ts-ignore`. Expected: none.
- [ ] Check 80 columns and trailing newlines on every touched file.
- [ ] Re-run both repos' gates. Report the touched files to Nadeem. Do not commit.
