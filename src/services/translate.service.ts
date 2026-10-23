import crypto from "node:crypto";
import {
  GOOGLE_TRANSLATE_API_KEY,
  TRANSLATION_SUPPORTED_LANGUAGES,
  TRANSLATION_TARGET_LANGUAGES,
} from "../contants.js";
import { Translation } from "../models/translation.model.js";

/** Longest text accepted by POST /api/translate (keeps per-request cost bounded). */
export const MAX_TRANSLATE_CHARS = 5000;

type TranslateApiResponse = {
  data?: {
    translations?: Array<{
      translatedText?: string;
      detectedSourceLanguage?: string;
    }>;
  };
  error?: { message?: string };
};

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

export function normalizeLanguage(lang?: string | null): string {
  return String(lang ?? "").trim().toLowerCase().split(/[-_]/)[0];
}

export function isTranslationConfigured() {
  return Boolean(GOOGLE_TRANSLATE_API_KEY);
}

/**
 * Single Google Cloud Translation v2 call. When `sourceLang` is omitted Google
 * auto-detects it in the same request, so no separate detect call is billed.
 * Throws on failure so errors are never cached as translations.
 */
async function googleTranslate(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<{ translatedText: string; sourceLanguage: string }> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw httpError("Translation service is not configured", 503);
  }

  const params = new URLSearchParams({
    key: GOOGLE_TRANSLATE_API_KEY,
    target: targetLang,
    format: "text",
  });
  if (sourceLang) params.set("source", sourceLang);

  let res: globalThis.Response;
  try {
    res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // Text goes in the body so long posts don't hit URL length limits.
        body: new URLSearchParams({ q: text }).toString(),
      }
    );
  } catch (err: any) {
    console.error("Google Translate network/request error:", err.message);
    throw httpError("Translation service unavailable", 502);
  }

  const json = (await res.json().catch(() => ({}))) as TranslateApiResponse;
  if (!res.ok) {
    const errorMsg = json.error?.message || "Translation failed";
    console.error("Google Translate error:", res.status, errorMsg);
    throw httpError(
      res.status === 403
        ? "Translation API is blocked or disabled in Google Cloud Console. Enable 'Cloud Translation API' on your API key."
        : `Translation failed: ${errorMsg}`,
      502
    );
  }

  const first = json.data?.translations?.[0];
  const translatedText = first?.translatedText?.trim();
  if (!translatedText) throw httpError("Translation failed", 502);

  return {
    translatedText,
    sourceLanguage: normalizeLanguage(first?.detectedSourceLanguage || sourceLang),
  };
}

/**
 * Pre-translate a post into TRANSLATION_TARGET_LANGUAGES at write time.
 * Empty by default: launch scope is on-demand translation only (cost control),
 * so this makes no API calls unless that env var is set.
 */
export async function buildPostTranslations(
  originalText: string,
  sourceLanguage?: string
): Promise<{ sourceLanguage: string; translations: Record<string, string> }> {
  const trimmed = originalText.trim();
  let sourceLang = normalizeLanguage(sourceLanguage);

  if (!trimmed || !TRANSLATION_TARGET_LANGUAGES.length || !GOOGLE_TRANSLATE_API_KEY) {
    return {
      sourceLanguage: sourceLang,
      translations: sourceLang ? { [sourceLang]: trimmed } : {},
    };
  }

  const translations: Record<string, string> = {};
  for (const target of TRANSLATION_TARGET_LANGUAGES) {
    if (target === sourceLang) continue;
    try {
      const result = await translateDynamicContent({
        text: trimmed,
        targetLanguage: target,
        sourceLanguage: sourceLang || undefined,
      });
      sourceLang = sourceLang || result.sourceLanguage;
      if (result.sourceLanguage !== target) {
        translations[target] = result.translatedText;
      }
    } catch {
      // Best effort: the post is still readable and translatable on demand.
    }
  }
  if (sourceLang) translations[sourceLang] = trimmed;

  return { sourceLanguage: sourceLang, translations };
}

export function pickTranslatedText(
  post: {
    text?: string;
    sourceLanguage?: string;
    translations?: Map<string, string> | Record<string, string>;
  },
  lang?: string
): string {
  const fallback = post.text ?? "";
  if (!lang) return fallback;

  const map =
    post.translations instanceof Map
      ? Object.fromEntries(post.translations.entries())
      : (post.translations ?? {});

  return map[lang] ?? map[post.sourceLanguage ?? ""] ?? fallback;
}

export type TranslateRequestInput = {
  text: string;
  targetLanguage?: string;
  sourceLanguage?: string;
};

export type TranslateResult = {
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  sourceLanguage: string;
  cached: boolean;
};

/** Small hot cache in front of Mongo; the Translation collection is the source of truth. */
const memoryCache = new Map<
  string,
  { translatedText: string; sourceLanguage: string }
>();
const MEMORY_CACHE_LIMIT = 2000;

function remember(
  key: string,
  value: { translatedText: string; sourceLanguage: string }
) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, value);
}

export async function translateDynamicContent(
  opts: TranslateRequestInput
): Promise<TranslateResult> {
  const rawText = String(opts.text ?? "").trim();
  if (!rawText) throw httpError("text is required", 400);
  if (rawText.length > MAX_TRANSLATE_CHARS) {
    throw httpError(`text must be at most ${MAX_TRANSLATE_CHARS} characters`, 400);
  }

  const targetLang = normalizeLanguage(opts.targetLanguage);
  if (!targetLang) throw httpError("targetLanguage is required", 400);
  if (!TRANSLATION_SUPPORTED_LANGUAGES.includes(targetLang)) {
    throw httpError(
      `Unsupported targetLanguage. Supported: ${TRANSLATION_SUPPORTED_LANGUAGES.join(", ")}`,
      400
    );
  }
  const sourceLang = normalizeLanguage(opts.sourceLanguage) || undefined;

  const textHash = crypto.createHash("sha256").update(rawText).digest("hex");
  const cacheKey = `${textHash}:${targetLang}`;

  const hot = memoryCache.get(cacheKey);
  if (hot) {
    return { originalText: rawText, ...hot, targetLanguage: targetLang, cached: true };
  }

  try {
    const stored = await Translation.findOneAndUpdate(
      { textHash, targetLanguage: targetLang },
      { $inc: { hits: 1 } },
      { new: true }
    ).lean();
    if (stored) {
      const value = {
        translatedText: stored.translatedText,
        sourceLanguage: stored.sourceLanguage || "",
      };
      remember(cacheKey, value);
      return { originalText: rawText, ...value, targetLanguage: targetLang, cached: true };
    }
  } catch (err: any) {
    console.error("Translation cache read failed:", err.message);
  }

  if (sourceLang === targetLang) {
    return {
      originalText: rawText,
      translatedText: rawText,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang,
      cached: false,
    };
  }

  const result = await googleTranslate(rawText, targetLang, sourceLang);
  // Same-language content: return the original untouched.
  const translatedText =
    result.sourceLanguage === targetLang ? rawText : result.translatedText;
  const value = { translatedText, sourceLanguage: result.sourceLanguage };

  remember(cacheKey, value);
  Translation.updateOne(
    { textHash, targetLanguage: targetLang },
    { $set: { ...value }, $setOnInsert: { hits: 0 } },
    { upsert: true }
  ).catch((err: any) =>
    console.error("Translation cache write failed:", err.message)
  );

  return { originalText: rawText, ...value, targetLanguage: targetLang, cached: false };
}
