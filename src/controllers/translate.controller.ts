import type { Request, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import * as translateService from "../services/translate.service.js";
import * as usersService from "../services/users.service.js";
import { User } from "../models/user.model.js";
import { TRANSLATION_SUPPORTED_LANGUAGES } from "../contants.js";

export const translateText = async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage, sourceLanguage, targetLang, sourceLang } =
      req.body ?? {};
    const effectiveTarget = targetLanguage || targetLang;
    const effectiveSource = sourceLanguage || sourceLang || undefined;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "text is required",
      });
    }
    if (!effectiveTarget || typeof effectiveTarget !== "string") {
      return res.status(400).json({
        success: false,
        message: "targetLanguage is required (e.g. 'en' or 'es')",
      });
    }

    const result = await translateService.translateDynamicContent({
      text,
      targetLanguage: String(effectiveTarget),
      sourceLanguage: effectiveSource ? String(effectiveSource) : undefined,
    });

    return res.json({
      success: true,
      originalText: result.originalText,
      translatedText: result.translatedText,
      targetLanguage: result.targetLanguage,
      sourceLanguage: result.sourceLanguage,
      cached: result.cached,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Translation failed",
    });
  }
};

export const updateLanguagePreference = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { preferredLanguage, language, targetLanguage } = req.body ?? {};
    const lang = preferredLanguage || language || targetLanguage;
    if (!lang || typeof lang !== "string") {
      return res.status(400).json({
        success: false,
        message: "preferredLanguage is required (e.g. 'en' or 'es')",
      });
    }

    const cleanLang = translateService.normalizeLanguage(lang);
    if (!TRANSLATION_SUPPORTED_LANGUAGES.includes(cleanLang)) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language. Supported: ${TRANSLATION_SUPPORTED_LANGUAGES.join(", ")}`,
      });
    }
    const profile = await usersService.updateMe(req.userId, {
      preferredLanguage: cleanLang,
    });

    return res.json({
      success: true,
      preferredLanguage: cleanLang,
      profile,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Failed to update language preference",
    });
  }
};

export const getLanguagePreference = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await User.findById(req.userId)
      .select("preferredLanguage")
      .lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    // null means the user never picked one; the app keeps its device language.
    return res.json({
      success: true,
      preferredLanguage: user.preferredLanguage || null,
      supportedLanguages: TRANSLATION_SUPPORTED_LANGUAGES,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Failed to fetch language preference",
    });
  }
};
