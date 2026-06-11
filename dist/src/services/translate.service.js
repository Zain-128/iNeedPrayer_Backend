import { GOOGLE_TRANSLATE_API_KEY, TRANSLATION_TARGET_LANGUAGES, } from "../contants.js";
async function googleTranslate(text, targetLang, sourceLang) {
    if (!GOOGLE_TRANSLATE_API_KEY)
        return text;
    const params = new URLSearchParams({
        key: GOOGLE_TRANSLATE_API_KEY,
        q: text,
        target: targetLang,
        format: "text",
    });
    if (sourceLang)
        params.set("source", sourceLang);
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params.toString()}`, { method: "POST" });
    if (!res.ok) {
        const errText = await res.text();
        console.error("Google Translate error:", res.status, errText);
        return text;
    }
    const json = (await res.json());
    return json.data?.translations?.[0]?.translatedText?.trim() || text;
}
export async function detectLanguage(text) {
    if (!GOOGLE_TRANSLATE_API_KEY || !text.trim())
        return "en";
    const params = new URLSearchParams({
        key: GOOGLE_TRANSLATE_API_KEY,
        q: text,
    });
    const res = await fetch(`https://translation.googleapis.com/language/translate/v2/detect?${params.toString()}`, { method: "POST" });
    if (!res.ok)
        return "en";
    const json = (await res.json());
    return json.data?.detections?.[0]?.[0]?.language?.split("-")[0] ?? "en";
}
/** Build map of language code → translated text (includes source language). */
export async function buildPostTranslations(originalText, sourceLanguage) {
    const trimmed = originalText.trim();
    if (!trimmed) {
        const lang = sourceLanguage?.trim() || "en";
        return { sourceLanguage: lang, translations: { [lang]: "" } };
    }
    const sourceLang = sourceLanguage?.trim() ||
        (GOOGLE_TRANSLATE_API_KEY ? await detectLanguage(trimmed) : "en");
    const translations = { [sourceLang]: trimmed };
    const targets = TRANSLATION_TARGET_LANGUAGES.filter((l) => l !== sourceLang);
    await Promise.all(targets.map(async (target) => {
        translations[target] = GOOGLE_TRANSLATE_API_KEY
            ? await googleTranslate(trimmed, target, sourceLang)
            : trimmed;
    }));
    return { sourceLanguage: sourceLang, translations };
}
export function pickTranslatedText(post, lang) {
    const fallback = post.text ?? "";
    if (!lang)
        return fallback;
    const map = post.translations instanceof Map
        ? Object.fromEntries(post.translations.entries())
        : (post.translations ?? {});
    return map[lang] ?? map[post.sourceLanguage ?? ""] ?? fallback;
}
