/** Per-user comment rate limit for live chat (ms between messages). */
export const LIVE_COMMENT_COOLDOWN_MS = 2000;

/** Max comment length. */
export const LIVE_COMMENT_MAX_LEN = 280;

/** Max comments kept in memory per session room. */
export const LIVE_COMMENT_BUFFER_SIZE = 100;

/** How often to flush batched comments to clients (ms). */
export const LIVE_COMMENT_BATCH_MS = 400;

/** Minimum interval between viewer-count broadcasts (ms). */
export const LIVE_VIEWER_COUNT_THROTTLE_MS = 3000;

type Bucket = { lastAt: number; count: number };

const commentBuckets = new Map<string, Bucket>();

export function checkCommentRateLimit(
  sessionId: string,
  userId: string
): { ok: true } | { ok: false; retryAfterMs: number } {
  const key = `${sessionId}:${userId}`;
  const now = Date.now();
  const prev = commentBuckets.get(key);

  if (prev && now - prev.lastAt < LIVE_COMMENT_COOLDOWN_MS) {
    return {
      ok: false,
      retryAfterMs: LIVE_COMMENT_COOLDOWN_MS - (now - prev.lastAt),
    };
  }

  commentBuckets.set(key, { lastAt: now, count: (prev?.count ?? 0) + 1 });
  return { ok: true };
}

export function clearCommentRateLimit(sessionId: string, userId: string) {
  commentBuckets.delete(`${sessionId}:${userId}`);
}

/** Periodic cleanup of stale buckets. */
export function pruneCommentRateLimits(maxAgeMs = 60_000) {
  const cutoff = Date.now() - maxAgeMs;
  for (const [key, bucket] of commentBuckets) {
    if (bucket.lastAt < cutoff) commentBuckets.delete(key);
  }
}
