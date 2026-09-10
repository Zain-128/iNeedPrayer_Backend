import { AdminSettings } from "../../models/adminSettings.model.js";
import { httpError } from "./admin.helpers.js";

export async function getSettings(category?: string) {
  const filter: Record<string, unknown> = {};
  if (category) filter.category = category;
  const docs = await AdminSettings.find(filter).sort({ key: 1 }).lean();
  // Return as key-value map
  const result: Record<string, unknown> = {};
  for (const doc of docs) {
    result[doc.key] = doc.value;
  }
  return result;
}

export async function getSettingsByCategory(category: string) {
  const docs = await AdminSettings.find({ category })
    .sort({ key: 1 })
    .lean();
  const result: Record<string, unknown> = {};
  for (const doc of docs) {
    result[doc.key] = doc.value;
  }
  return { category, settings: result };
}

export async function updateSettings(
  updates: Record<string, unknown>,
  category?: string,
  updatedBy?: string
) {
  const results: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    const doc = await AdminSettings.findOneAndUpdate(
      { key },
      {
        key,
        value,
        category: category ?? "general",
        updatedBy: updatedBy || null,
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();
    results[doc.key] = doc.value;
  }
  return results;
}

export async function deleteSetting(key: string) {
  const doc = await AdminSettings.findOneAndDelete({ key }).lean();
  if (!doc) throw httpError("Setting not found", 404);
  return { message: "Setting deleted", key };
}

export async function getNotificationSettings() {
  return getSettings("notifications");
}

export async function updateNotificationSettings(
  settings: Record<string, unknown>,
  updatedBy?: string
) {
  return updateSettings(settings, "notifications", updatedBy);
}
