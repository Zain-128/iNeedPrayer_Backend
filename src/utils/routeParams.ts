/** Normalize Express req.params segment (string or string[]). */
export function paramStr(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}
