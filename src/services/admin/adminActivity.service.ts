import mongoose from "mongoose";
import {
  AdminActivity,
  type AdminActivityType,
} from "../../models/adminActivity.model.js";
import { User } from "../../models/user.model.js";

export async function recordAdminActivity(input: {
  type: AdminActivityType;
  title: string;
  message?: string;
  refType?: string;
  refId?: string;
  actorId?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    let actorName = "";
    let actorAvatar = "";
    if (input.actorId && mongoose.isValidObjectId(input.actorId)) {
      const u = await User.findById(input.actorId)
        .select("name avatar")
        .lean();
      actorName = u?.name ?? "";
      actorAvatar = u?.avatar ?? "";
    }

    await AdminActivity.create({
      type: input.type,
      title: input.title,
      message: input.message ?? "",
      refType: input.refType ?? "",
      refId: input.refId ?? "",
      actorId: input.actorId && mongoose.isValidObjectId(input.actorId)
        ? input.actorId
        : null,
      actorName,
      actorAvatar,
      meta: input.meta ?? {},
    });
  } catch (err) {
    console.error("[adminActivity] record failed:", err);
  }
}
