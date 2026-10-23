import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    memberKey: { type: String, required: true, unique: true, index: true },
    kind: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
      index: true,
    },
    members: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      required: true,
    },
    title: { type: String, default: "" },
    image: { type: String, default: "" },
    description: { type: String, default: "" },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    isCommunityGroup: { type: Boolean, default: false },
    privacy: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    status: {
      type: String,
      enum: ["active", "pending", "declined"],
      default: "active",
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    admins: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    lastMessageText: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastReadAt: {
      type: Map,
      of: Date,
      default: {},
    },
    archivedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    mutedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mutedUntil: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

conversationSchema.pre("validate", async function () {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = this as any;
  const kind = doc.kind || "direct";
  const members: mongoose.Types.ObjectId[] = doc.members || [];
  if (kind === "group") {
    if (members.length < 1) {
      throw new Error("Group must have at least 1 member");
    }
    if (!doc.title || !String(doc.title).trim()) {
      doc.title = "Group Chat";
    }
    if (!doc.admins?.length && members.length > 0) doc.admins = [members[0]];
  } else {
    if (members.length !== 2) {
      throw new Error("Direct chat must have exactly 2 members");
    }
    doc.title = "";
    doc.image = "";
    doc.admins = [];
  }
});

export function conversationMemberKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export function newGroupMemberKey(): string {
  return `grp:${new mongoose.Types.ObjectId().toString()}`;
}

export const Conversation = mongoose.model("Conversation", conversationSchema);
