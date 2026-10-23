import crypto from "node:crypto";
import {
  GOOGLE_TRANSLATE_API_KEY,
  TRANSLATION_SUPPORTED_LANGUAGES,
  TRANSLATION_TARGET_LANGUAGES
} from "../contants.js";
import { Translation } from "../models/translation.model.js";
const MAX_TRANSLATE_CHARS = 5e3;
function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}
function normalizeLanguage(lang) {
  return String(lang ?? "").trim().toLowerCase().split(/[-_]/)[0];
}
function isTranslationConfigured() {
  return Boolean(GOOGLE_TRANSLATE_API_KEY);
}
async function googleTranslate(text, targetLang, sourceLang) {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw httpError("Translation service is not configured", 503);
  }
  const params = new URLSearchParams({
    key: GOOGLE_TRANSLATE_API_KEY,
    target: targetLang,
    format: "text"
  });
  if (sourceLang) params.set("source", sourceLang);
  let res;
  try {
    res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        // Text goes in the body so long posts don't hit URL length limits.
        body: new URLSearchParams({ q: text }).toString()
      }
    );
  } catch (err) {
    console.error("Google Translate network/request error:", err.message);
    throw httpError("Translation service unavailable", 502);
  }
  const json = await res.json().catch(() => ({}));
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
    sourceLanguage: normalizeLanguage(first?.detectedSourceLanguage || sourceLang)
  };
}
async function buildPostTranslations(originalText, sourceLanguage) {
  const trimmed = originalText.trim();
  let sourceLang = normalizeLanguage(sourceLanguage);
  if (!trimmed || !TRANSLATION_TARGET_LANGUAGES.length || !GOOGLE_TRANSLATE_API_KEY) {
    return {
      sourceLanguage: sourceLang,
      translations: sourceLang ? { [sourceLang]: trimmed } : {}
    };
  }
  const translations = {};
  for (const target of TRANSLATION_TARGET_LANGUAGES) {
    if (target === sourceLang) continue;
    try {
      const result = await translateDynamicContent({
        text: trimmed,
        targetLanguage: target,
        sourceLanguage: sourceLang || void 0
      });
      sourceLang = sourceLang || result.sourceLanguage;
      if (result.sourceLanguage !== target) {
        translations[target] = result.translatedText;
      }
    } catch {
    }
  }
  if (sourceLang) translations[sourceLang] = trimmed;
  return { sourceLanguage: sourceLang, translations };
}
function pickTranslatedText(post, lang) {
  const fallback = post.text ?? "";
  if (!lang) return fallback;
  const map = post.translations instanceof Map ? Object.fromEntries(post.translations.entries()) : post.translations ?? {};
  return map[lang] ?? map[post.sourceLanguage ?? ""] ?? fallback;
}
const memoryCache = /* @__PURE__ */ new Map();
const MEMORY_CACHE_LIMIT = 2e3;
function remember(key, value) {
  if (memoryCache.size >= MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, value);
}
async function translateDynamicContent(opts) {
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
  const sourceLang = normalizeLanguage(opts.sourceLanguage) || void 0;
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
      const value2 = {
        translatedText: stored.translatedText,
        sourceLanguage: stored.sourceLanguage || ""
      };
      remember(cacheKey, value2);
      return { originalText: rawText, ...value2, targetLanguage: targetLang, cached: true };
    }
  } catch (err) {
    console.error("Translation cache read failed:", err.message);
  }
  if (sourceLang === targetLang) {
    return {
      originalText: rawText,
      translatedText: rawText,
      targetLanguage: targetLang,
      sourceLanguage: sourceLang,
      cached: false
    };
  }
  const result = await googleTranslate(rawText, targetLang, sourceLang);
  const translatedText = result.sourceLanguage === targetLang ? rawText : result.translatedText;
  const value = { translatedText, sourceLanguage: result.sourceLanguage };
  remember(cacheKey, value);
  Translation.updateOne(
    { textHash, targetLanguage: targetLang },
    { $set: { ...value }, $setOnInsert: { hits: 0 } },
    { upsert: true }
  ).catch(
    (err) => console.error("Translation cache write failed:", err.message)
  );
  return { originalText: rawText, ...value, targetLanguage: targetLang, cached: false };
}
export {
  MAX_TRANSLATE_CHARS,
  buildPostTranslations,
  isTranslationConfigured,
  normalizeLanguage,
  pickTranslatedText,
  translateDynamicContent
};
