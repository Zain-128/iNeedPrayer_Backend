import mongoose from "mongoose";

/**
 * Cache of on-demand translations for user-generated content.
 * Keyed by a hash of the exact source text, so editing a post/comment
 * produces a new hash and the old translation is never served for it.
 */
const translationSchema = new mongoose.Schema(
  {
    textHash: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    sourceLanguage: { type: String, default: "" },
    translatedText: { type: String, required: true },
    hits: { type: Number, default: 0 },
  },
  { timestamps: true }
);

translationSchema.index({ textHash: 1, targetLanguage: 1 }, { unique: true });

export const Translation = mongoose.model("Translation", translationSchema);
