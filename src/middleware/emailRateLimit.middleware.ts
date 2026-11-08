import type { Request, Response, NextFunction } from "express";

interface RateLimitRecord {
  timestamps: number[];
  lastRequestTime: number;
}

const ipLimitMap = new Map<string, RateLimitRecord>();
const emailLimitMap = new Map<string, RateLimitRecord>();
const churchLimitMap = new Map<string, RateLimitRecord>();

const IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const IP_MAX_REQUESTS = 5; // Max 5 requests per 10 mins per IP

const EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_MAX_REQUESTS = 3; // Max 3 requests per 15 mins per email
const EMAIL_MIN_COOLDOWN_MS = 60 * 1000; // 60 seconds minimum gap between requests

// Periodic cleanup of stale records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of ipLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < IP_WINDOW_MS);
    if (record.timestamps.length === 0) ipLimitMap.delete(key);
  }
  for (const [key, record] of emailLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < EMAIL_WINDOW_MS);
    if (record.timestamps.length === 0) emailLimitMap.delete(key);
  }
  for (const [key, record] of churchLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < EMAIL_WINDOW_MS);
    if (record.timestamps.length === 0) churchLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Rate limiter for POST /api/auth/forgot-password.
 * Enforces per-IP and per-Email limits and 60-second cooldown to protect SMTP.
 */
export function forgotPasswordRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const rawEmail = req.body?.email;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const now = Date.now();

  // 1. Check IP rate limit
  let ipRecord = ipLimitMap.get(ip);
  if (!ipRecord) {
    ipRecord = { timestamps: [], lastRequestTime: 0 };
    ipLimitMap.set(ip, ipRecord);
  }
  ipRecord.timestamps = ipRecord.timestamps.filter((t) => now - t < IP_WINDOW_MS);
  if (ipRecord.timestamps.length >= IP_MAX_REQUESTS) {
    const oldest = ipRecord.timestamps[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + IP_WINDOW_MS - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      success: false,
      message: `Too many password reset requests from this network. Please wait ${retryAfter}s.`,
      retryAfterSeconds: retryAfter,
    });
  }

  // 2. Check Email rate limit & cooldown
  if (email) {
    let emailRecord = emailLimitMap.get(email);
    if (!emailRecord) {
      emailRecord = { timestamps: [], lastRequestTime: 0 };
      emailLimitMap.set(email, emailRecord);
    }

    // Cooldown check
    const timeSinceLast = now - emailRecord.lastRequestTime;
    if (timeSinceLast < EMAIL_MIN_COOLDOWN_MS) {
      const waitSeconds = Math.max(1, Math.ceil((EMAIL_MIN_COOLDOWN_MS - timeSinceLast) / 1000));
      res.setHeader("Retry-After", String(waitSeconds));
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting another reset code.`,
        retryAfterSeconds: waitSeconds,
      });
    }

    emailRecord.timestamps = emailRecord.timestamps.filter((t) => now - t < EMAIL_WINDOW_MS);
    if (emailRecord.timestamps.length >= EMAIL_MAX_REQUESTS) {
      const oldest = emailRecord.timestamps[0];
      const waitSeconds = Math.max(1, Math.ceil((oldest + EMAIL_WINDOW_MS - now) / 1000));
      res.setHeader("Retry-After", String(waitSeconds));
      return res.status(429).json({
        success: false,
        message: `Too many reset codes requested for this email. Please wait ${Math.ceil(waitSeconds / 60)} minutes.`,
        retryAfterSeconds: waitSeconds,
      });
    }

    emailRecord.timestamps.push(now);
    emailRecord.lastRequestTime = now;
  }

  ipRecord.timestamps.push(now);
  ipRecord.lastRequestTime = now;
  next();
}

/**
 * Rate limiter for church verification requests (POST /api/churches/:id/send-verification).
 * Enforces per-church 60-second cooldown and max 3 requests per 15 minutes.
 */
export function churchVerificationRateLimiter(req: Request, res: Response, next: NextFunction) {
  const churchId = String(req.params?.id || req.body?.churchId || getClientIp(req)).trim();
  const now = Date.now();

  let record = churchLimitMap.get(churchId);
  if (!record) {
    record = { timestamps: [], lastRequestTime: 0 };
    churchLimitMap.set(churchId, record);
  }

  const timeSinceLast = now - record.lastRequestTime;
  if (timeSinceLast < EMAIL_MIN_COOLDOWN_MS) {
    const waitSeconds = Math.max(1, Math.ceil((EMAIL_MIN_COOLDOWN_MS - timeSinceLast) / 1000));
    res.setHeader("Retry-After", String(waitSeconds));
    return res.status(429).json({
      success: false,
      message: `Please wait ${waitSeconds}s before requesting a new church verification code.`,
      retryAfterSeconds: waitSeconds,
    });
  }

  record.timestamps = record.timestamps.filter((t) => now - t < EMAIL_WINDOW_MS);
  if (record.timestamps.length >= EMAIL_MAX_REQUESTS) {
    const oldest = record.timestamps[0];
    const waitSeconds = Math.max(1, Math.ceil((oldest + EMAIL_WINDOW_MS - now) / 1000));
    res.setHeader("Retry-After", String(waitSeconds));
    return res.status(429).json({
      success: false,
      message: `Too many church verification requests. Please wait ${Math.ceil(waitSeconds / 60)} minutes.`,
      retryAfterSeconds: waitSeconds,
    });
  }

  record.timestamps.push(now);
  record.lastRequestTime = now;
  next();
}
