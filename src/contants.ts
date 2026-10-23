import dotenv from "dotenv";
import path from "path";
dotenv.config();
export const PORT = process.env.PORT || 3004;
export const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/iNeedPrayer";
export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const JWT_ACCESS_EXPIRES_IN =
  process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "7d";
/** Refresh token TTL (social login + future refresh route). */
export const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
/** Defaults to JWT_SECRET if unset; use a separate secret in production. */
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";

/** Dev-style fixed reset code. Only accepted while SMTP is not configured. */
export const PASSWORD_RESET_CODE = process.env.PASSWORD_RESET_CODE ?? "1234";

/** SMTP (transactional + campaign email). When host/user/pass are set, real emails are sent. */
export const SMTP_HOST = (process.env.SMTP_HOST ?? "").trim();
export const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
/** true for port 465 (SSL); false for 587 (STARTTLS). Defaults from port. */
export const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === "true"
  : SMTP_PORT === 465;
export const SMTP_USER = (process.env.SMTP_USER ?? "").trim();
export const SMTP_PASS = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
export const MAIL_FROM_EMAIL = (
  process.env.MAIL_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || SMTP_USER
).trim();
export const MAIL_FROM_NAME = (
  process.env.MAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "iNeedPrayer"
).trim();
/** Reply-To / support address shown in email footers. */
export const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || MAIL_FROM_EMAIL).trim();
/** Optional absolute logo URL for email header; text logo is used when unset. */
export const EMAIL_LOGO_URL = (process.env.EMAIL_LOGO_URL ?? "").trim();

export function isSmtpConfigured(): boolean {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM_EMAIL);
}

/** Comma-separated origins for CORS; if unset, allows any origin (fine for mobile + Bearer auth). */
/** Church verification stub (UI flow only until email/OTP is wired). */
export const CHURCH_VERIFY_CODE = process.env.CHURCH_VERIFY_CODE ?? "12345";

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

function cleanEnv(val: string | undefined): string {
  return (val ?? "").replace(/[\r\n\u2028\u2029]/g, "").trim();
}

/** Backblaze B2 or AWS S3 (S3-compatible). When all are set, POST /api/upload/image uses bucket instead of local disk. */
export const B2_S3_ENDPOINT = cleanEnv(
  process.env.B2_S3_ENDPOINT ||
  process.env.AWS_S3_ENDPOINT ||
  process.env.S3_ENDPOINT
);

/** e.g. us-east-005 or us-west-004 — auto-derived from endpoint if not explicitly provided. */
export const B2_REGION = ((): string => {
  const explicit = cleanEnv(
    process.env.B2_REGION ||
    process.env.AWS_REGION ||
    process.env.S3_REGION
  );
  if (explicit) return explicit;
  const match = B2_S3_ENDPOINT.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match ? match[1] : "";
})();

export const B2_KEY_ID = cleanEnv(
  process.env.B2_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.S3_KEY_ID
);

export const B2_APPLICATION_KEY = cleanEnv(
  process.env.B2_APPLICATION_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  process.env.S3_SECRET_KEY
);

export const B2_BUCKET = cleanEnv(
  process.env.B2_BUCKET ||
  process.env.AWS_BUCKET ||
  process.env.S3_BUCKET
);

/**
 * Public download base (no trailing slash). Example:
 * https://f005.backblazeb2.com/file/your-bucket-name
 */
export const B2_PUBLIC_URL_BASE = ((): string => {
  const explicit = cleanEnv(
    process.env.B2_PUBLIC_URL_BASE ||
    process.env.AWS_PUBLIC_URL_BASE ||
    process.env.S3_PUBLIC_URL
  ).replace(/\/$/, "");
  if (explicit) return explicit;

  // Derive friendly B2 download URL if cluster number is detectable (e.g. us-east-005 -> f005)
  if (B2_BUCKET && B2_S3_ENDPOINT) {
    const clusterMatch = B2_S3_ENDPOINT.match(/us-[a-z]+-([0-9]{3})/i);
    if (clusterMatch) {
      return `https://f${clusterMatch[1]}.backblazeb2.com/file/${B2_BUCKET}`;
    }
    return `${B2_S3_ENDPOINT}/${B2_BUCKET}`;
  }
  return "";
})();

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

export function getB2MissingKeys(): string[] {
  const missing: string[] = [];
  if (!B2_S3_ENDPOINT) missing.push("B2_S3_ENDPOINT");
  if (!B2_REGION) missing.push("B2_REGION");
  if (!B2_KEY_ID) missing.push("B2_KEY_ID");
  if (!B2_APPLICATION_KEY) missing.push("B2_APPLICATION_KEY");
  if (!B2_BUCKET) missing.push("B2_BUCKET");
  if (!B2_PUBLIC_URL_BASE) missing.push("B2_PUBLIC_URL_BASE");
  return missing;
}

/** Google Cloud Translation API key (server-side only; never ship it in the app). Falls back to the Places key — enable "Cloud Translation API" on that project. */
export const GOOGLE_TRANSLATE_API_KEY = (
  process.env.GOOGLE_TRANSLATE_API_KEY ??
  process.env.GOOGLE_PLACES_API_KEY ??
  ""
).trim();

/** Google Places API (New) key for Church Finder nearby search. */
export const GOOGLE_PLACES_API_KEY = (
  process.env.GOOGLE_PLACES_API_KEY ?? ""
).trim();

/**
 * Languages to pre-translate posts into at create/edit time. Empty by default:
 * launch scope is on-demand "See Translation" only, to keep API costs down.
 */
export const TRANSLATION_TARGET_LANGUAGES = (
  process.env.TRANSLATION_TARGET_LANGUAGES ?? ""
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Target languages accepted by POST /api/translate and language preference. */
export const TRANSLATION_SUPPORTED_LANGUAGES = (
  process.env.TRANSLATION_SUPPORTED_LANGUAGES ?? "en,es"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Agora RTC — required for live streaming token generation. */
export const AGORA_APP_ID = (process.env.AGORA_APP_ID ?? "").trim();
export const AGORA_APP_CERTIFICATE = (
  process.env.AGORA_APP_CERTIFICATE ?? ""
).trim();
export const AGORA_TOKEN_EXPIRY_SECONDS = Math.max(
  300,
  parseInt(process.env.AGORA_TOKEN_EXPIRY_SECONDS ?? "3600", 10) || 3600
);

/** Host must heartbeat within this window or session auto-ends. */
export const LIVE_HOST_HEARTBEAT_TIMEOUT_MS = Math.max(
  30_000,
  parseInt(process.env.LIVE_HOST_HEARTBEAT_TIMEOUT_MS ?? "90000", 10) || 90_000
);

/** Stripe */
export const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
export const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
export const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY ?? "").trim();
export const STRIPE_PRICE_YEARLY = (process.env.STRIPE_PRICE_YEARLY ?? "").trim();

/** Coins pricing (USD cents) and IAP product SKUs */
export const COINS_PACKAGES = [
  { name: "Starter", coins: 100, priceCents: 99, label: "100 Coins", tag: "Entry", positioning: "Entry", bonusText: "", appStoreProductId: "com.shawntorres.ineedprayer.coins100", googlePlayProductId: "coins100" },
  { name: "Popular", coins: 525, priceCents: 499, label: "525 Coins", tag: "Popular", positioning: "Popular", bonusText: "500 + 25 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins500", googlePlayProductId: "coins500" },
  { name: "Supporter", coins: 1100, priceCents: 999, label: "1,100 Coins", tag: "Supporter", positioning: "Supporter", bonusText: "1,000 + 100 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins1000", googlePlayProductId: "coins1000" },
  { name: "Best Value", coins: 2750, priceCents: 2499, label: "2,750 Coins", tag: "Best Value", positioning: "Best Value", bonusText: "2,500 + 250 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins2500", googlePlayProductId: "coins2500" },
  { name: "Patron", coins: 5750, priceCents: 4999, label: "5,750 Coins", tag: "Patron", positioning: "Patron", bonusText: "5,000 + 750 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins5000", googlePlayProductId: "coins5000" },
];

/** Platform fee taken from donations / super chats before crediting group/church (basis points). 1000 = 10%. */
export const PLATFORM_FEE_BPS = Math.min(
  5000,
  Math.max(0, parseInt(process.env.PLATFORM_FEE_BPS ?? "1000", 10) || 1000)
);

/** Withdrawal estimate: cents paid out per coin (1 = $0.01). */
export const COIN_WITHDRAW_VALUE_CENTS = Math.max(
  1,
  parseInt(process.env.COIN_WITHDRAW_VALUE_CENTS ?? "1", 10) || 1
);

/** Custom coin purchase bounds */
export const CUSTOM_COINS_MIN = 50;
export const CUSTOM_COINS_MAX = 50_000;

/** Price per coin for custom purchases (cents), aligned with ~100 coins = $0.99 */
export const CUSTOM_COIN_UNIT_CENTS = 0.99;
