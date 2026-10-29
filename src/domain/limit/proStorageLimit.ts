export function resolveBaseStorageLimit(input: {
  rowLimit: number | null;
  defaultLimit: number;
  pro: boolean;
  proLimit: number;
}): number {
  const base = input.rowLimit ?? input.defaultLimit;
  return input.pro ? Math.max(base, input.proLimit) : base;
}
