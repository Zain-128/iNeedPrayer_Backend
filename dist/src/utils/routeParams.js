/** Normalize Express req.params segment (string or string[]). */
export function paramStr(v) {
    if (v === undefined)
        return "";
    return Array.isArray(v) ? (v[0] ?? "") : v;
}
