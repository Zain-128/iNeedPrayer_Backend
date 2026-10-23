import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  timestamps: number[];
}

/** In-memory store for rate limiting */
const rateLimitMap = new Map<string, RateLimitRecord>();

/** Options for places rate limiter */
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

/** Cleanup stale keys every 5 minutes */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);
    if (record.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

export function placesRateLimiter(req: Request, res: Response, next: NextFunction) {
  // Determine identifier: forwarded IP, remote IP, or fallback
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
    req.socket.remoteAddress ||
    "unknown";

  const identifier = `places:${ip}`;
  const now = Date.now();

  let record = rateLimitMap.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(identifier, record);
  }

  // Filter timestamps within sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < WINDOW_MS);

  if (record.timestamps.length >= MAX_REQUESTS) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));

    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
    res.setHeader("X-RateLimit-Remaining", "0");

    return res.status(429).json({
      success: false,
      message: "Too many requests to Church Finder. Please wait a moment before searching again.",
      retryAfterSeconds,
    });
  }

  record.timestamps.push(now);
  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader(
    "X-RateLimit-Remaining",
    String(Math.max(0, MAX_REQUESTS - record.timestamps.length))
  );

  next();
}
