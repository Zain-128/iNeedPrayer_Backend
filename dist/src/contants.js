import path from "path";
import dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT || 3004;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/iNeedPrayer";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || process.env.JWT_EXPIRES_IN || "7d";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "your-secret-key-change-in-production";
const PASSWORD_RESET_CODE = process.env.PASSWORD_RESET_CODE ?? "1234";
const SMTP_HOST = (process.env.SMTP_HOST ?? "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : SMTP_PORT === 465;
const SMTP_USER = (process.env.SMTP_USER ?? "").trim();
const SMTP_PASS = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim();
const MAIL_FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || SMTP_USER).trim();
const MAIL_FROM_NAME = (process.env.MAIL_FROM_NAME || process.env.SMTP_FROM_NAME || "iNeedPrayer").trim();
const SUPPORT_EMAIL = (process.env.SUPPORT_EMAIL || MAIL_FROM_EMAIL).trim();
const EMAIL_LOGO_URL = (process.env.EMAIL_LOGO_URL ?? "").trim();
function isSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM_EMAIL);
}
const CHURCH_VERIFY_CODE = process.env.CHURCH_VERIFY_CODE ?? "12345";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : null;
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
function publicUrlForUpload(relativePath) {
  const u = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  if (!PUBLIC_BASE_URL) return { url: u };
  return { url: u, absoluteUrl: `${PUBLIC_BASE_URL}${u}` };
}
function cleanEnv(val) {
  return (val ?? "").replace(/[\r\n\u2028\u2029]/g, "").trim();
}
const B2_S3_ENDPOINT = cleanEnv(
  process.env.B2_S3_ENDPOINT || process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT
);
const B2_REGION = (() => {
  const explicit = cleanEnv(
    process.env.B2_REGION || process.env.AWS_REGION || process.env.S3_REGION
  );
  if (explicit) return explicit;
  const match = B2_S3_ENDPOINT.match(/s3\.([a-z0-9-]+)\.backblazeb2\.com/i);
  return match ? match[1] : "";
})();
const B2_KEY_ID = cleanEnv(
  process.env.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.S3_KEY_ID
);
const B2_APPLICATION_KEY = cleanEnv(
  process.env.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY
);
const B2_BUCKET = cleanEnv(
  process.env.B2_BUCKET || process.env.AWS_BUCKET || process.env.S3_BUCKET
);
const B2_PUBLIC_URL_BASE = (() => {
  const explicit = cleanEnv(
    process.env.B2_PUBLIC_URL_BASE || process.env.AWS_PUBLIC_URL_BASE || process.env.S3_PUBLIC_URL
  ).replace(/\/$/, "");
  if (explicit) return explicit;
  if (B2_BUCKET && B2_S3_ENDPOINT) {
    const clusterMatch = B2_S3_ENDPOINT.match(/us-[a-z]+-([0-9]{3})/i);
    if (clusterMatch) {
      return `https://f${clusterMatch[1]}.backblazeb2.com/file/${B2_BUCKET}`;
    }
    return `${B2_S3_ENDPOINT}/${B2_BUCKET}`;
  }
  return "";
})();
function isB2Configured() {
  return Boolean(B2_S3_ENDPOINT) && Boolean(B2_REGION) && Boolean(B2_KEY_ID) && Boolean(B2_APPLICATION_KEY) && Boolean(B2_BUCKET) && Boolean(B2_PUBLIC_URL_BASE);
}
function getB2MissingKeys() {
  const missing = [];
  if (!B2_S3_ENDPOINT) missing.push("B2_S3_ENDPOINT");
  if (!B2_REGION) missing.push("B2_REGION");
  if (!B2_KEY_ID) missing.push("B2_KEY_ID");
  if (!B2_APPLICATION_KEY) missing.push("B2_APPLICATION_KEY");
  if (!B2_BUCKET) missing.push("B2_BUCKET");
  if (!B2_PUBLIC_URL_BASE) missing.push("B2_PUBLIC_URL_BASE");
  return missing;
}
const GOOGLE_TRANSLATE_API_KEY = (process.env.GOOGLE_TRANSLATE_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
const GOOGLE_PLACES_API_KEY = (process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
const TRANSLATION_TARGET_LANGUAGES = (process.env.TRANSLATION_TARGET_LANGUAGES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const TRANSLATION_SUPPORTED_LANGUAGES = (process.env.TRANSLATION_SUPPORTED_LANGUAGES ?? "en,es").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const AGORA_APP_ID = (process.env.AGORA_APP_ID ?? "").trim();
const AGORA_APP_CERTIFICATE = (process.env.AGORA_APP_CERTIFICATE ?? "").trim();
const AGORA_TOKEN_EXPIRY_SECONDS = Math.max(
  300,
  parseInt(process.env.AGORA_TOKEN_EXPIRY_SECONDS ?? "3600", 10) || 3600
);
const LIVE_HOST_HEARTBEAT_TIMEOUT_MS = Math.max(
  3e4,
  parseInt(process.env.LIVE_HOST_HEARTBEAT_TIMEOUT_MS ?? "90000", 10) || 9e4
);
const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY ?? "").trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY ?? "").trim();
const STRIPE_PRICE_YEARLY = (process.env.STRIPE_PRICE_YEARLY ?? "").trim();
const COINS_PACKAGES = [
  { name: "Starter", coins: 100, priceCents: 99, label: "100 Coins", tag: "Entry", positioning: "Entry", bonusText: "", appStoreProductId: "com.shawntorres.ineedprayer.coins100", googlePlayProductId: "coins100" },
  { name: "Popular", coins: 525, priceCents: 499, label: "525 Coins", tag: "Popular", positioning: "Popular", bonusText: "500 + 25 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins500", googlePlayProductId: "coins500" },
  { name: "Supporter", coins: 1100, priceCents: 999, label: "1,100 Coins", tag: "Supporter", positioning: "Supporter", bonusText: "1,000 + 100 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins1000", googlePlayProductId: "coins1000" },
  { name: "Best Value", coins: 2750, priceCents: 2499, label: "2,750 Coins", tag: "Best Value", positioning: "Best Value", bonusText: "2,500 + 250 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins2500", googlePlayProductId: "coins2500" },
  { name: "Patron", coins: 5750, priceCents: 4999, label: "5,750 Coins", tag: "Patron", positioning: "Patron", bonusText: "5,000 + 750 bonus", appStoreProductId: "com.shawntorres.ineedprayer.coins5000", googlePlayProductId: "coins5000" }
];
const PLATFORM_FEE_BPS = Math.min(
  5e3,
  Math.max(0, parseInt(process.env.PLATFORM_FEE_BPS ?? "1000", 10) || 1e3)
);
const COIN_WITHDRAW_VALUE_CENTS = Math.max(
  1,
  parseInt(process.env.COIN_WITHDRAW_VALUE_CENTS ?? "1", 10) || 1
);
const CUSTOM_COINS_MIN = 50;
const CUSTOM_COINS_MAX = 5e4;
const CUSTOM_COIN_UNIT_CENTS = 0.99;
export {
  AGORA_APP_CERTIFICATE,
  AGORA_APP_ID,
  AGORA_TOKEN_EXPIRY_SECONDS,
  ALLOWED_ORIGINS,
  B2_APPLICATION_KEY,
  B2_BUCKET,
  B2_KEY_ID,
  B2_PUBLIC_URL_BASE,
  B2_REGION,
  B2_S3_ENDPOINT,
  CHURCH_VERIFY_CODE,
  COINS_PACKAGES,
  COIN_WITHDRAW_VALUE_CENTS,
  CUSTOM_COINS_MAX,
  CUSTOM_COINS_MIN,
  CUSTOM_COIN_UNIT_CENTS,
  EMAIL_LOGO_URL,
  GOOGLE_PLACES_API_KEY,
  GOOGLE_TRANSLATE_API_KEY,
  JWT_ACCESS_EXPIRES_IN,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  JWT_REFRESH_SECRET,
  JWT_SECRET,
  LIVE_HOST_HEARTBEAT_TIMEOUT_MS,
  MAIL_FROM_EMAIL,
  MAIL_FROM_NAME,
  MONGO_URI,
  PASSWORD_RESET_CODE,
  PLATFORM_FEE_BPS,
  PORT,
  PUBLIC_BASE_URL,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_YEARLY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPPORT_EMAIL,
  TRANSLATION_SUPPORTED_LANGUAGES,
  TRANSLATION_TARGET_LANGUAGES,
  UPLOAD_ROOT,
  getB2MissingKeys,
  isB2Configured,
  isSmtpConfigured,
  publicUrlForUpload
};
