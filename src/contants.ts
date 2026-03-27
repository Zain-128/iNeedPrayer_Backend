import path from "path";
import dotenv from "dotenv";
dotenv.config();
export const PORT = process.env.PORT || 3004;
export const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/iNeedPrayer";
export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
/** Access token TTL (used for login/register/social accessToken). */
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const JWT_ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "7d";
/** Refresh token TTL (social login + future refresh route). */
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
/** Defaults to JWT_SECRET if unset; use a separate secret in production. */
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";

/** Dev-style fixed reset code (no email). Change/remove before real production. */
export const PASSWORD_RESET_CODE = process.env.PASSWORD_RESET_CODE ?? "1234";

/** Comma-separated origins for CORS; if unset, allows any origin (fine for mobile + Bearer auth). */
/** Church verification stub (UI flow only until email/OTP is wired). */
export const CHURCH_VERIFY_CODE = process.env.CHURCH_VERIFY_CODE ?? "0000";

export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

/** Where uploaded files are stored (project root /uploads). */
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

/**
 * Public API origin for absolute image URLs (e.g. https://api.yourapp.com).
 * Omit in dev; mobile clients can prepend their API base to `url` from upload response.
 */
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

export function publicUrlForUpload(relativePath: string): {
  url: string;
  absoluteUrl?: string;
} {
  const u = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  if (!PUBLIC_BASE_URL) return { url: u };
  return { url: u, absoluteUrl: `${PUBLIC_BASE_URL}${u}` };
}

/** Backblaze B2 (S3-compatible). When all are set, POST /api/upload/image uses B2 instead of local disk. */
export const B2_S3_ENDPOINT = (process.env.B2_S3_ENDPOINT ?? "").trim();
/** e.g. us-west-004 — must match your bucket region. */
export const B2_REGION = (process.env.B2_REGION ?? "").trim();
export const B2_KEY_ID = (process.env.B2_KEY_ID ?? "").trim();
export const B2_APPLICATION_KEY = (process.env.B2_APPLICATION_KEY ?? "").trim();
export const B2_BUCKET = (process.env.B2_BUCKET ?? "").trim();
/**
 * Public download base (no trailing slash). Example:
 * https://f005.backblazeb2.com/file/your-bucket-name
 * (from Bucket → Public / Friendly URL in B2 console, or your CDN origin.)
 */
export const B2_PUBLIC_URL_BASE = (process.env.B2_PUBLIC_URL_BASE ?? "")
  .trim()
  .replace(/\/$/, "");

export function isB2Configured(): boolean {
  return (
    Boolean(B2_S3_ENDPOINT) &&
    Boolean(B2_REGION) &&
    Boolean(B2_KEY_ID) &&
    Boolean(B2_APPLICATION_KEY) &&
    Boolean(B2_BUCKET) &&
    Boolean(B2_PUBLIC_URL_BASE)
  );
}
