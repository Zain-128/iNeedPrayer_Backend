export function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${Math.max(1, sec)} secs`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"}`;
  const w = Math.floor(d / 7);
  return `${w} wk${w === 1 ? "" : "s"}`;
}

export function formatCountLabel(n: number, suffix: string): string {
  const num = Math.max(0, Math.floor(n));
  if (num >= 1_000_000) {
    const x = num / 1_000_000;
    return `${x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}M ${suffix}`;
  }
  if (num >= 1_000) {
    const x = num / 1_000;
    return `${x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}k ${suffix}`;
  }
  return `${num} ${suffix}`;
}
