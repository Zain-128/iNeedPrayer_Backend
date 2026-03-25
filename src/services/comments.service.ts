import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Post } from "../models/post.model.js";
import { mapCommentTree, type CommentLean } from "../utils/mappers.js";

export async function listCommentsForPost(postId: string) {
  const post = await Post.findById(postId).lean();
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const all = await Comment.find({ post: postId })
    .sort({ createdAt: 1 })
    .populate("author", "name avatar")
    .lean();

  const typed = all as unknown as CommentLean[];
  const top = typed.filter((c) => !c.parentComment);
  const replyMap = new Map<string, CommentLean[]>();
  for (const c of typed) {
    if (c.parentComment) {
      const pid = String(c.parentComment);
      const arr = replyMap.get(pid) ?? [];
      arr.push(c);
      replyMap.set(pid, arr);
    }
  }
  return top.map((c) => mapCommentTree(c, replyMap));
}

export async function addComment(
  postId: string,
  authorId: string,
  text: string,
  parentCommentId?: string
) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  let parentComment: mongoose.Types.ObjectId | null = null;
  if (parentCommentId) {
    const parent = await Comment.findOne({
      _id: parentCommentId,
      post: postId,
    });
    if (!parent) {
      const err = new Error("Parent comment not found");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
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
  return listCommentsForPost(postId);
}

async function deleteSubtree(commentId: mongoose.Types.ObjectId): Promise<number> {
  const kids = await Comment.find({ parentComment: commentId }).select("_id");
  let n = 1;
  for (const k of kids) {
    n += await deleteSubtree(k._id);
  }
  await Comment.deleteOne({ _id: commentId });
  return n;
}

export async function deleteComment(commentId: string, userId: string) {
  const c = await Comment.findById(commentId);
  if (!c) {
    const err = new Error("Comment not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  if (c.author.toString() !== userId) {
    const err = new Error("Not allowed");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  const post = await Post.findById(c.post);
  const removed = await deleteSubtree(c._id);
  if (post) {
    post.commentsCount = Math.max(0, post.commentsCount - removed);
    await post.save();
  }
}
