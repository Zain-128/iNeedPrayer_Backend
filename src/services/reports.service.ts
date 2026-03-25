import { Report } from "../models/report.model.js";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";

export async function reportPost(
  reporterId: string,
  postId: string,
  reasonKey: string,
  otherText?: string
) {
  const post = await Post.findById(postId);
  if (!post) {
    const err = new Error("Post not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  await Report.create({
    reporter: reporterId,
    targetType: "post",
    post: postId,
    reasonKey,
    otherText: otherText?.trim() ?? "",
  });
}

export async function reportComment(
  reporterId: string,
  commentId: string,
  reasonKey: string,
  otherText?: string
) {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const err = new Error("Comment not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  await Report.create({
    reporter: reporterId,
    targetType: "comment",
    comment: commentId,
    post: comment.post,
    reasonKey,
    otherText: otherText?.trim() ?? "",
  });
}
