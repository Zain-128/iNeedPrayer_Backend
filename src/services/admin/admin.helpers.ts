export function parsePageLimit(query: {
  page?: unknown;
  limit?: unknown;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function listMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export function escapeRegex(q: string) {
  return q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function httpError(message: string, statusCode: number) {
  const err = new Error(message);
  (err as Error & { statusCode?: number }).statusCode = statusCode;
  return err;
}

export function formatDisplayDate(d?: Date | null) {
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseMoneyToCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const num = Number(cleaned);
    if (!Number.isFinite(num)) return 0;
    return Math.round(num * 100);
  }
  return 0;
}
