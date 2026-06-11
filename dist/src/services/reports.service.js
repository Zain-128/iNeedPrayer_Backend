import { Report } from "../models/report.model.js";
import { Post } from "../models/post.model.js";
import { Comment } from "../models/comment.model.js";
import { Group } from "../models/group.model.js";
export async function reportPost(reporterId, postId, reasonKey, otherText) {
    const post = await Post.findById(postId);
    if (!post) {
        const err = new Error("Post not found");
        err.statusCode = 404;
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
export async function reportComment(reporterId, commentId, reasonKey, otherText) {
    const comment = await Comment.findById(commentId);
    if (!comment) {
        const err = new Error("Comment not found");
        err.statusCode = 404;
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
export async function reportGroup(reporterId, groupId, reasonKey, otherText) {
    const group = await Group.findById(groupId);
    if (!group) {
        const err = new Error("Group not found");
        err.statusCode = 404;
        throw err;
    }
    await Report.create({
        reporter: reporterId,
        targetType: "group",
        group: groupId,
        reasonKey,
        otherText: otherText?.trim() ?? "",
    });
}
