import mongoose from "mongoose";

export interface IGroupNotificationSettings {
  group: mongoose.Types.ObjectId;
  newMemberJoined: boolean;
  memberLeft: boolean;
  newJoinRequest: boolean;
  invitationAccepted: boolean;
  newCommunityPost: boolean;
  newPrayerRequest: boolean;
  newPraisePost: boolean;
  newComments: boolean;
  communityLiveStreamStarted: boolean;
  communityDonationsSupport: boolean;
  memberReports: boolean;
  communityAnnouncements: boolean;
}

const groupNotificationSettingsSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      unique: true,
      index: true,
    },
    newMemberJoined: { type: Boolean, default: true },
    memberLeft: { type: Boolean, default: true },
    newJoinRequest: { type: Boolean, default: true },
    invitationAccepted: { type: Boolean, default: true },
    newCommunityPost: { type: Boolean, default: true },
    newPrayerRequest: { type: Boolean, default: true },
    newPraisePost: { type: Boolean, default: true },
    newComments: { type: Boolean, default: true },
    communityLiveStreamStarted: { type: Boolean, default: true },
    communityDonationsSupport: { type: Boolean, default: true },
    memberReports: { type: Boolean, default: true },
    communityAnnouncements: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GroupNotificationSettings = mongoose.model(
  "GroupNotificationSettings",
  groupNotificationSettingsSchema
);
