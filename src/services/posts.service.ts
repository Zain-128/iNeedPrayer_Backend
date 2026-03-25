import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { PostReaction } from "../models/postReaction.model.js";
import { Comment } from "../models/comment.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { mapPost } from "../utils/mappers.js";

async function excludedAuthorIds(
  viewerId?: string
): Promise<mongoose.Types.ObjectId[]> {
  if (!viewerId) return [];
  const me = new mongoose.Types.ObjectId(viewerId);
  const [iBlocked, blockedMe] = await Promise.all([
    UserBlock.find({ blocker: me }).distinct("blocked"),
    UserBlock.find({ blocked: me }).distinct("blocker"),
  ]);
  return [...iBlocked, ...blockedMe];
}

async function reactionFlags(userId: string | undefined, postIds: string[]) {
  if (!userId || !postIds.length) {
    return new Map<string, { pray: boolean; praise: boolean }>();
  }
  const uid = new mongoose.Types.ObjectId(userId);
  const rows = await PostReaction.find({
    user: uid,
    post: { $in: postIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();
  const m = new Map<string, { pray: boolean; praise: boolean }>();
  for (const id of postIds) {
    m.set(id, { pray: false, praise: false });
  }
  for (const r of rows) {
    const pid = String(r.post);
    const cur = m.get(pid) ?? { pray: false, praise: false };
    if (r.type === "pray") cur.pray = true;
    if (r.type === "praise") cur.praise = true;
    m.set(pid, cur);
  }
  return m;
}

export async function listPosts(opts: {
  viewerId?: string;
  q?: string;
  page?: number;
  limit?: number;
  groupId?: string;
  authorId?: string;
  churchId?: string;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const exclude = await excludedAuthorIds(opts.viewerId);
  const conditions: Record<string, unknown>[] = [];

  if (opts.authorId) {
    if (exclude.some((id) => id.toString() === opts.authorId)) {
      return { posts: [], page, limit, total: 0 };
    }
    conditions.push({ author: new mongoose.Types.ObjectId(opts.authorId) });
  } else if (exclude.length) {
    conditions.push({ author: { $nin: exclude } });
  }

  if (opts.groupId) conditions.push({ group: opts.groupId });
  if (opts.churchId) conditions.push({ church: opts.churchId });

  if (opts.q?.trim()) {
    const rx = new RegExp(
      opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    const users = await User.find({
      $or: [{ name: rx }, { email: rx }],
    })
      .select("_id")
      .lean();
    const userIds = users.map((u) => u._id);
    conditions.push({
      $or: [{ text: rx }, { author: { $in: userIds } }],
    });
  }

  const filter =
    conditions.length === 0
      ? {}
      : conditions.length === 1
        ? conditions[0]
        : { $and: conditions };

  const [total, docs] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "name avatar city state country")
      .lean(),
  ]);

  const ids = docs.map((d) => d._id.toString());
  const flags = await reactionFlags(opts.viewerId, ids);
  const posts = docs.map((p) => {
    const f = flags.get(p._id.toString()) ?? { pray: false, praise: false };
    return mapPost(p as never, {
      prayed: f.pray,
      praised: f.praise,
    });
  });

  return { posts, page, limit, total };
}

export async function getPost(postId: string, viewerId?: string) {
  const exclude = await excludedAuthorIds(viewerId);
  const post = await Post.findById(postId)
    .populate("author", "name avatar city state country")
    .lean();
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (
    exclude.some((id) => id.toString() === (post.author as { _id: mongoose.Types.ObjectId })._id.toString())
  ) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const flags = await reactionFlags(viewerId, [postId]);
  const f = flags.get(postId) ?? { pray: false, praise: false };
  return mapPost(post as never, {
    prayed: f.pray,
    praised: f.praise,
  });
}

export async function createPost(
  authorId: string,
  body: {
    text?: string;
    image?: string;
    mode?: "prayer" | "praise";
    groupId?: string;
    churchId?: string;
  }
) {
  if (body.groupId) {
    const gm = await GroupMember.findOne({
      group: body.groupId,
      user: authorId,
    });
    if (!gm) {
      const err = new Error("Not a member of this group");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  const post = await Post.create({
    author: authorId,
    text: body.text?.trim() ?? "",
    image: body.image?.trim() ?? "",
    mode: body.mode === "praise" ? "praise" : "prayer",
    group: body.groupId || null,
    church: body.churchId || null,
  });
  await User.findByIdAndUpdate(authorId, { $inc: { postsCount: 1 } });
  const populated = await Post.findById(post._id)
    .populate("author", "name avatar city state country")
    .lean();
  const flags = await reactionFlags(authorId, [String(post._id)]);
  const f = flags.get(String(post._id)) ?? { pray: false, praise: false };
  return mapPost(populated as never, {
    prayed: f.pray,
    praised: f.praise,
  });
}

export async function updatePost(
  postId: string,
  authorId: string,
  body: { text?: string; image?: string; mode?: "prayer" | "praise" }
) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (post.author.toString() !== authorId) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (body.text !== undefined) post.text = body.text.trim();
  if (body.image !== undefined) post.image = body.image.trim();
  if (body.mode !== undefined)
    post.mode = body.mode === "praise" ? "praise" : "prayer";
  await post.save();
  const populated = await Post.findById(post._id)
    .populate("author", "name avatar city state country")
    .lean();
  const flags = await reactionFlags(authorId, [postId]);
  const f = flags.get(postId) ?? { pray: false, praise: false };
  return mapPost(populated as never, {
    prayed: f.pray,
    praised: f.praise,
  });
}

export async function deletePost(postId: string, authorId: string) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (post.author.toString() !== authorId) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  await Promise.all([
    PostReaction.deleteMany({ post: postId }),
    Comment.deleteMany({ post: postId }),
    post.deleteOne(),
    User.findByIdAndUpdate(authorId, { $inc: { postsCount: -1 } }),
  ]);
}

export async function togglePray(postId: string, userId: string) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const existing = await PostReaction.findOne({
    post: postId,
    user: userId,
    type: "pray",
  });
  if (existing) {
    await existing.deleteOne();
    post.praysCount = Math.max(0, post.praysCount - 1);
    await post.save();
    return { active: false, praysCount: post.praysCount };
  }
  await PostReaction.create({ post: postId, user: userId, type: "pray" });
  post.praysCount += 1;
  await post.save();
  return { active: true, praysCount: post.praysCount };
}

export async function togglePraise(postId: string, userId: string) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const existing = await PostReaction.findOne({
    post: postId,
    user: userId,
    type: "praise",
  });
  if (existing) {
    await existing.deleteOne();
    post.praisesCount = Math.max(0, post.praisesCount - 1);
    await post.save();
    return { active: false, praisesCount: post.praisesCount };
  }
  await PostReaction.create({ post: postId, user: userId, type: "praise" });
  post.praisesCount += 1;
  await post.save();
  return { active: true, praisesCount: post.praisesCount };
}

export async function incrementShare(postId: string) {
  const post = await Post.findByIdAndUpdate(
    postId,
    { $inc: { sharesCount: 1 } },
    { new: true }
  );
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  return { sharesCount: post.sharesCount };
}

export async function listPrayPraiseUsers(
  postId: string,
  type: "pray" | "praise"
) {
  const rows = await PostReaction.find({ post: postId, type })
    .populate("user", "name avatar")
    .lean();
  return rows.map((r) => {
    const u = r.user as unknown as {
      _id: mongoose.Types.ObjectId;
      name: string;
      avatar?: string;
    };
    return {
      id: u._id.toString(),
      name: u.name,
      avatar: u.avatar ?? "",
      type,
    };
  });
}
