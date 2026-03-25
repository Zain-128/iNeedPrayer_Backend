import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as postsService from "../services/posts.service.js";
import * as commentsService from "../services/comments.service.js";
import * as reportsService from "../services/reports.service.js";
import { paramStr } from "../utils/routeParams.js";

function badId(res: Response) {
  return res.status(400).json({ message: "Invalid id" });
}

export const listPosts = async (req: AuthRequest, res: Response) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await postsService.listPosts({
      viewerId: req.userId,
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      page,
      limit,
      groupId: typeof req.query.groupId === "string" ? req.query.groupId : undefined,
      authorId: typeof req.query.authorId === "string" ? req.query.authorId : undefined,
      churchId: typeof req.query.churchId === "string" ? req.query.churchId : undefined,
    });
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getPost = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const post = await postsService.getPost(id, req.userId);
    return res.json({ post });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const post = await postsService.createPost(req.userId, req.body ?? {});
    return res.status(201).json({ post });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const post = await postsService.updatePost(id, req.userId, req.body ?? {});
    return res.json({ post });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    await postsService.deletePost(id, req.userId);
    return res.json({ message: "Deleted" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const pray = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const result = await postsService.togglePray(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const praise = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const result = await postsService.togglePraise(id, req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const share = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const result = await postsService.incrementShare(id);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const prayPraiseUsers = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const type = req.query.type === "praise" ? "praise" : "pray";
    const users = await postsService.listPrayPraiseUsers(id, type);
    return res.json({ users });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listComments = async (req: AuthRequest, res: Response) => {
  try {
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const comments = await commentsService.listCommentsForPost(id);
    return res.json({ comments });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const { text, parentCommentId } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ message: "text is required" });
    }
    const comments = await commentsService.addComment(
      id,
      req.userId,
      text,
      typeof parentCommentId === "string" ? parentCommentId : undefined
    );
    return res.status(201).json({ comments });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const reportPost = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) return badId(res);
    const { reasonKey, otherText } = req.body ?? {};
    if (!reasonKey || typeof reasonKey !== "string") {
      return res.status(400).json({ message: "reasonKey is required" });
    }
    await reportsService.reportPost(req.userId, id, reasonKey, otherText);
    return res.json({ message: "Report submitted" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
