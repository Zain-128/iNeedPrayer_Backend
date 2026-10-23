import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";

/** In-memory sliding window: protects the paid translation quota from abuse. */
const rateLimitMap = new Map<string, number[]>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 translations per minute per user/IP

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const fresh = timestamps.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) rateLimitMap.set(key, fresh);
    else rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function translateRateLimiter(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
    req.socket.remoteAddress ||
    "unknown";
  const userId = (req as AuthRequest).userId;
  const identifier = userId ? `translate:user:${userId}` : `translate:ip:${ip}`;
  const now = Date.now();

  const timestamps = (rateLimitMap.get(identifier) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((timestamps[0] + WINDOW_MS - now) / 1000)
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    rateLimitMap.set(identifier, timestamps);
    return res.status(429).json({
      success: false,
      message: "Too many translation requests. Please wait a moment and try again.",
      retryAfterSeconds,
    });
  }

  timestamps.push(now);
  rateLimitMap.set(identifier, timestamps);
  next();
}
