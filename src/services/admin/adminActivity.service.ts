import mongoose from "mongoose";
import {
  AdminActivity,
  type AdminActivityType,
} from "../../models/adminActivity.model.js";
import { User } from "../../models/user.model.js";
import { getIo } from "../../socket/ioSingleton.js";
import { formatDisplayDate } from "./admin.helpers.js";

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

    const activity = await AdminActivity.create({
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

    // Calculate total unread count (activities not read by any admin)
    const unreadCount = await AdminActivity.countDocuments({
      readBy: { $size: 0 },
    });

    const io = getIo();
    if (io) {
      const notificationPayload = {
        id: activity._id.toString(),
        type: activity.type,
        title: activity.title,
        message: activity.message,
        refType: activity.refType,
        refId: activity.refId,
        actorId: activity.actorId?.toString() ?? null,
        actorName: activity.actorName || "",
        actorAvatar: activity.actorAvatar || "",
        meta: activity.meta ?? {},
        isRead: false,
        read: false,
        createdAt: activity.createdAt,
        time: formatDisplayDate(activity.createdAt),
      };

      io.emit("admin:notification:new", {
        notification: notificationPayload,
        unreadCount,
      });
    }
  } catch (err) {
    console.error("[adminActivity] record failed:", err);
  }
}
