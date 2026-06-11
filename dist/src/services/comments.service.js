import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { CommentReaction } from "../models/commentReaction.model.js";
import { Post } from "../models/post.model.js";
import { mapCommentTree } from "../utils/mappers.js";
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
async function commentReactionFlags(userId, commentIds) {
    if (!userId || !commentIds.length) {
        return new Map();
    }
    const uid = new mongoose.Types.ObjectId(userId);
    const rows = await CommentReaction.find({
        user: uid,
        comment: { $in: commentIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();
    const m = new Map();
    for (const id of commentIds) {
        m.set(id, { pray: false, praise: false });
    }
    for (const r of rows) {
        const cid = String(r.comment);
        const cur = m.get(cid) ?? { pray: false, praise: false };
        if (r.type === "pray")
            cur.pray = true;
        if (r.type === "praise")
            cur.praise = true;
        m.set(cid, cur);
    }
    return m;
}
export async function listCommentsForPost(postId, viewerId) {
    const post = await Post.findById(postId).lean();
    if (!post)
        throw httpError("Post not found", 404);
    const all = await Comment.find({ post: postId })
        .sort({ createdAt: 1 })
        .populate("author", "name avatar")
        .lean();
    const typed = all;
    const flags = await commentReactionFlags(viewerId, typed.map((c) => c._id.toString()));
    const top = typed.filter((c) => !c.parentComment);
    const replyMap = new Map();
    for (const c of typed) {
        if (c.parentComment) {
            const pid = String(c.parentComment);
            const arr = replyMap.get(pid) ?? [];
            arr.push(c);
            replyMap.set(pid, arr);
        }
    }
    return top.map((c) => mapCommentTree(c, replyMap, flags));
}
export async function addComment(postId, authorId, text, parentCommentId) {
    const post = await Post.findById(postId);
    if (!post)
        throw httpError("Post not found", 404);
    let parentComment = null;
    if (parentCommentId) {
        const parent = await Comment.findOne({
            _id: parentCommentId,
            post: postId,
        });
        if (!parent)
            throw httpError("Parent comment not found", 400);
        parentComment = parent._id;
    }
    await Comment.create({
        post: postId,
        author: authorId,
        text: text.trim(),
        parentComment,
    });
    post.commentsCount += 1;
    await post.save();
    return listCommentsForPost(postId, authorId);
}
export async function editComment(commentId, userId, text) {
    const trimmed = text.trim();
    if (!trimmed)
        throw httpError("text is required", 400);
    const comment = await Comment.findById(commentId).populate("author", "name avatar");
    if (!comment)
        throw httpError("Comment not found", 404);
    if (comment.author._id.toString() !== userId) {
        throw httpError("Not allowed", 403);
    }
    comment.text = trimmed;
    await comment.save();
    const flags = await commentReactionFlags(userId, [commentId]);
    const lean = comment.toObject();
    return mapCommentTree(lean, new Map(), flags);
}
async function deleteSubtree(commentId) {
    const kids = await Comment.find({ parentComment: commentId }).select("_id");
    let n = 1;
    for (const k of kids) {
        n += await deleteSubtree(k._id);
    }
    await CommentReaction.deleteMany({ comment: commentId });
    await Comment.deleteOne({ _id: commentId });
    return n;
}
export async function deleteComment(commentId, userId) {
    const c = await Comment.findById(commentId);
    if (!c)
        throw httpError("Comment not found", 404);
    if (c.author.toString() !== userId)
        throw httpError("Not allowed", 403);
    const post = await Post.findById(c.post);
    const removed = await deleteSubtree(c._id);
    if (post) {
        post.commentsCount = Math.max(0, post.commentsCount - removed);
        await post.save();
    }
}
export async function togglePray(commentId, userId) {
    const comment = await Comment.findById(commentId);
    if (!comment)
        throw httpError("Comment not found", 404);
    const existing = await CommentReaction.findOne({
        comment: commentId,
        user: userId,
        type: "pray",
    });
    if (existing) {
        await existing.deleteOne();
        comment.praysCount = Math.max(0, comment.praysCount - 1);
        await comment.save();
        return { active: false, praysCount: comment.praysCount };
    }
    await CommentReaction.create({
        comment: commentId,
        user: userId,
        type: "pray",
    });
    comment.praysCount += 1;
    await comment.save();
    return { active: true, praysCount: comment.praysCount };
}
export async function togglePraise(commentId, userId) {
    const comment = await Comment.findById(commentId);
    if (!comment)
        throw httpError("Comment not found", 404);
    const existing = await CommentReaction.findOne({
        comment: commentId,
        user: userId,
        type: "praise",
    });
    if (existing) {
        await existing.deleteOne();
        comment.praisesCount = Math.max(0, comment.praisesCount - 1);
        await comment.save();
        return { active: false, praisesCount: comment.praisesCount };
    }
    await CommentReaction.create({
        comment: commentId,
        user: userId,
        type: "praise",
    });
    comment.praisesCount += 1;
    await comment.save();
    return { active: true, praisesCount: comment.praisesCount };
}
