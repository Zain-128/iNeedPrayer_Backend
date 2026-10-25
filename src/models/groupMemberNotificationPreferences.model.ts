import mongoose from "mongoose";

export interface IGroupMemberNotificationPreferences {
  group: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  allNotifications: boolean;
  newPosts: boolean;
  prayerPraiseUpdates: boolean;
  commentsReplies: boolean;
  liveStreamNotifications: boolean;
  communityAnnouncements: boolean;
  muteCommunityNotifications: boolean;
}

const groupMemberNotificationPreferencesSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    allNotifications: { type: Boolean, default: true },
    newPosts: { type: Boolean, default: true },
    prayerPraiseUpdates: { type: Boolean, default: true },
    commentsReplies: { type: Boolean, default: true },
    liveStreamNotifications: { type: Boolean, default: true },
    communityAnnouncements: { type: Boolean, default: true },
    muteCommunityNotifications: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupMemberNotificationPreferencesSchema.index(
  { group: 1, user: 1 },
  { unique: true }
);

export const GroupMemberNotificationPreferences = mongoose.model(
  "GroupMemberNotificationPreferences",
  groupMemberNotificationPreferencesSchema
);
