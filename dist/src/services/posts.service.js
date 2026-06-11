import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { PostReaction } from "../models/postReaction.model.js";
import { Comment } from "../models/comment.model.js";
import { CommentReaction } from "../models/commentReaction.model.js";
import { User } from "../models/user.model.js";
import { UserBlock } from "../models/userBlock.model.js";
import { GroupMember } from "../models/groupMember.model.js";
import { ChurchMember } from "../models/churchMember.model.js";
import { mapPost } from "../utils/mappers.js";
import { buildPostTranslations } from "./translate.service.js";
async function excludedAuthorIds(viewerId) {
    if (!viewerId)
        return [];
    const me = new mongoose.Types.ObjectId(viewerId);
    const [iBlocked, blockedMe] = await Promise.all([
        UserBlock.find({ blocker: me }).distinct("blocked"),
        UserBlock.find({ blocked: me }).distinct("blocker"),
    ]);
    return [...iBlocked, ...blockedMe];
}
async function reactionFlags(userId, postIds) {
    if (!userId || !postIds.length) {
        return new Map();
    }
    const uid = new mongoose.Types.ObjectId(userId);
    const rows = await PostReaction.find({
        user: uid,
        post: { $in: postIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();
    const m = new Map();
    for (const id of postIds) {
        m.set(id, { pray: false, praise: false, like: false });
    }
    for (const r of rows) {
        const pid = String(r.post);
        const cur = m.get(pid) ?? { pray: false, praise: false, like: false };
        if (r.type === "pray")
            cur.pray = true;
        if (r.type === "praise")
            cur.praise = true;
        if (r.type === "like")
            cur.like = true;
        m.set(pid, cur);
    }
    return m;
}
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
async function assertPostTarget(authorId, groupId, churchId) {
    if (groupId && churchId) {
        throw httpError("Post cannot belong to both a group and a church", 400);
    }
    if (groupId) {
        const gm = await GroupMember.findOne({ group: groupId, user: authorId });
        if (!gm)
            throw httpError("Not a member of this group", 403);
    }
    if (churchId) {
        const cm = await ChurchMember.findOne({ church: churchId, user: authorId });
        if (!cm)
            throw httpError("Not a member of this church", 403);
    }
}
export async function listPosts(opts) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;
    const exclude = await excludedAuthorIds(opts.viewerId);
    const conditions = [];
    if (opts.authorId) {
        if (exclude.some((id) => id.toString() === opts.authorId)) {
            return { posts: [], page, limit, total: 0 };
        }
        conditions.push({ author: new mongoose.Types.ObjectId(opts.authorId) });
    }
    else if (exclude.length) {
        conditions.push({ author: { $nin: exclude } });
    }
    if (opts.groupId)
        conditions.push({ group: opts.groupId });
    if (opts.churchId)
        conditions.push({ church: opts.churchId });
    if (opts.q?.trim()) {
        const rx = new RegExp(opts.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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
    const filter = conditions.length === 0
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
        const f = flags.get(p._id.toString()) ?? { pray: false, praise: false, like: false };
        return mapPost(p, {
            prayed: f.pray,
            praised: f.praise,
            liked: f.like,
            lang: opts.lang,
        });
    });
    return { posts, page, limit, total };
}
export async function getPost(postId, viewerId, lang) {
    const exclude = await excludedAuthorIds(viewerId);
    const post = await Post.findById(postId)
        .populate("author", "name avatar city state country")
        .lean();
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
        throw err;
    }
    if (exclude.some((id) => id.toString() === post.author._id.toString())) {
        const err = new Error("Post not found");
        err.statusCode = 404;
        throw err;
    }
    const flags = await reactionFlags(viewerId, [postId]);
    const f = flags.get(postId) ?? { pray: false, praise: false, like: false };
    return mapPost(post, {
        prayed: f.pray,
        praised: f.praise,
        liked: f.like,
        lang,
    });
}
export async function createPost(authorId, body) {
    await assertPostTarget(authorId, body.groupId, body.churchId);
    const rawText = body.text?.trim() ?? "";
    const { sourceLanguage, translations } = await buildPostTranslations(rawText, body.sourceLanguage);
    const post = await Post.create({
        author: authorId,
        text: rawText,
        sourceLanguage,
        translations,
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
    const f = flags.get(String(post._id)) ?? { pray: false, praise: false, like: false };
    return mapPost(populated, {
        prayed: f.pray,
        praised: f.praise,
        liked: f.like,
    });
}
export async function updatePost(postId, authorId, body) {
    const post = await Post.findById(postId);
    if (!post)
        throw httpError("Post not found", 404);
    if (post.author.toString() !== authorId)
        throw httpError("Not allowed", 403);
    if (body.text !== undefined) {
        const rawText = body.text.trim();
        const { sourceLanguage, translations } = await buildPostTranslations(rawText, body.sourceLanguage ?? post.sourceLanguage);
        post.text = rawText;
        post.sourceLanguage = sourceLanguage;
        post.translations = translations;
    }
    if (body.image !== undefined)
        post.image = body.image.trim();
    if (body.mode !== undefined)
        post.mode = body.mode === "praise" ? "praise" : "prayer";
    await post.save();
    const populated = await Post.findById(post._id)
        .populate("author", "name avatar city state country")
        .lean();
    const flags = await reactionFlags(authorId, [postId]);
    const f = flags.get(postId) ?? { pray: false, praise: false, like: false };
    return mapPost(populated, {
        prayed: f.pray,
        praised: f.praise,
        liked: f.like,
    });
}
export async function deletePost(postId, authorId) {
    const post = await Post.findById(postId);
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
        throw err;
    }
    if (post.author.toString() !== authorId) {
        const err = new Error("Not allowed");
        err.statusCode = 403;
        throw err;
    }
    const commentIds = await Comment.find({ post: postId }).distinct("_id");
    await Promise.all([
        PostReaction.deleteMany({ post: postId }),
        CommentReaction.deleteMany({ comment: { $in: commentIds } }),
        Comment.deleteMany({ post: postId }),
        post.deleteOne(),
        User.findByIdAndUpdate(authorId, { $inc: { postsCount: -1 } }),
    ]);
}
export async function togglePray(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
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
export async function togglePraise(postId, userId) {
    const post = await Post.findById(postId);
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
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
export async function toggleLike(postId, userId) {
    const post = await Post.findById(postId);
    if (!post)
        throw httpError("Post not found", 404);
    const existing = await PostReaction.findOne({
        post: postId,
        user: userId,
        type: "like",
    });
    if (existing) {
        await existing.deleteOne();
        post.likesCount = Math.max(0, post.likesCount - 1);
        await post.save();
        return { liked: false, likesCount: post.likesCount };
    }
    await PostReaction.create({ post: postId, user: userId, type: "like" });
    post.likesCount += 1;
    await post.save();
    return { liked: true, likesCount: post.likesCount };
}
export async function unlikePost(postId, userId) {
    const post = await Post.findById(postId);
    if (!post)
        throw httpError("Post not found", 404);
    const existing = await PostReaction.findOne({
        post: postId,
        user: userId,
        type: "like",
    });
    if (!existing)
        return { liked: false, likesCount: post.likesCount };
    await existing.deleteOne();
    post.likesCount = Math.max(0, post.likesCount - 1);
    await post.save();
    return { liked: false, likesCount: post.likesCount };
}
export async function incrementShare(postId) {
    const post = await Post.findByIdAndUpdate(postId, { $inc: { sharesCount: 1 } }, { new: true });
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
        throw err;
    }
    return { sharesCount: post.sharesCount };
}
export async function listPrayPraiseUsers(postId, type) {
    const rows = await PostReaction.find({ post: postId, type })
        .populate("user", "name avatar")
        .lean();
    return rows.map((r) => {
        const u = r.user;
        return {
            id: u._id.toString(),
            name: u.name,
            avatar: u.avatar ?? "",
            type,
        };
    });
}
