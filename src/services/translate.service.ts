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
  return true;
}

async function fallbackGoogleTranslate(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<{ translatedText: string; sourceLanguage: string }> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
    sourceLang || "auto"
  )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw httpError(`Translation service unavailable: ${res.status}`, 502);
  }

  const json = (await res.json()) as any;
  const segments = Array.isArray(json?.[0]) ? json[0] : [];
  const translatedText = segments
    .map((seg: any) =>
      Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""
    )
    .join("")
    .trim();

  const detectedSource =
    typeof json?.[2] === "string" ? json[2] : sourceLang || "en";

  if (!translatedText) {
    throw httpError("Translation returned empty result", 502);
  }

  return {
    translatedText,
    sourceLanguage: normalizeLanguage(detectedSource),
  };
}

/**
 * Single Google Cloud Translation v2 call with automated fallback.
 * When `sourceLang` is omitted Google auto-detects it.
 */
async function googleTranslate(
  text: string,
  targetLang: string,
  sourceLang?: string
): Promise<{ translatedText: string; sourceLanguage: string }> {
  if (GOOGLE_TRANSLATE_API_KEY) {
    const params = new URLSearchParams({
      key: GOOGLE_TRANSLATE_API_KEY,
      target: targetLang,
      format: "text",
    });
    if (sourceLang) params.set("source", sourceLang);

    try {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ q: text }).toString(),
        }
      );

      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as TranslateApiResponse;
        const first = json.data?.translations?.[0];
        const translatedText = first?.translatedText?.trim();
        if (translatedText) {
          return {
            translatedText,
            sourceLanguage: normalizeLanguage(first?.detectedSourceLanguage || sourceLang),
          };
        }
      } else {
        console.warn("Google Translate Cloud API returned status:", res.status, "Falling back to public translator...");
      }
    } catch (err: any) {
      console.warn("Google Translate Cloud API request failed:", err?.message, "Falling back to public translator...");
    }
  }

  return fallbackGoogleTranslate(text, targetLang, sourceLang);
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

  let activeTargetLang = targetLang;
  if (sourceLang && sourceLang === activeTargetLang) {
    activeTargetLang = activeTargetLang === "es" ? "en" : "es";
  }

  let result = await googleTranslate(rawText, activeTargetLang, sourceLang);
  if (result.sourceLanguage === activeTargetLang) {
    const alternateLang = activeTargetLang === "es" ? "en" : "es";
    try {
      const alt = await googleTranslate(rawText, alternateLang, result.sourceLanguage);
      if (alt.translatedText && alt.translatedText !== rawText) {
        result = alt;
        activeTargetLang = alternateLang;
      }
    } catch {}
  }

  const translatedText = result.translatedText || rawText;
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
