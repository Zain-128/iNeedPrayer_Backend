import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as usersService from "../services/users.service.js";
import * as postsService from "../services/posts.service.js";
import * as friendsService from "../services/friends.service.js";
import { pickUploadedFile, saveUploadedImage } from "../utils/imageUpload.js";
import { paramStr } from "../utils/routeParams.js";

function handleError(res: Response, err: unknown) {
  const e = err as Error & { statusCode?: number };
  return res.status(e.statusCode ?? 500).json({ message: e.message });
}

function badUserId(res: Response) {
  return res.status(400).json({ message: "Invalid user id" });
}

export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await usersService.getMyProfile(req.userId);
    return res.json({ profile });
  } catch (err) {
    return handleError(res, err);
  }
};

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const profile = await usersService.updateMe(req.userId, req.body ?? {});
    return res.json({ profile });
  } catch (err) {
    return handleError(res, err);
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const file = pickUploadedFile(
      req.files as Record<string, Express.Multer.File[]> | undefined
    );
    if (!file) {
      return res
        .status(400)
        .json({ message: 'No image file (use multipart field "image" or "file")' });
    }
    const saved = await saveUploadedImage(file.buffer, "avatar");
    const profile = await usersService.updateMe(req.userId, {
      avatar: saved.url,
    });
    return res.status(201).json({ url: saved.url, profile });
  } catch (err) {
    console.error("uploadAvatar", err);
    return res.status(500).json({ message: "Could not upload profile image" });
  }
};

export const uploadCover = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const file = pickUploadedFile(
      req.files as Record<string, Express.Multer.File[]> | undefined
    );
    if (!file) {
      return res
        .status(400)
        .json({ message: 'No image file (use multipart field "image" or "file")' });
    }
    const saved = await saveUploadedImage(file.buffer, "cover");
    const profile = await usersService.updateMe(req.userId, {
      coverImage: saved.url,
    });
    return res.status(201).json({ url: saved.url, profile });
  } catch (err) {
    console.error("uploadCover", err);
    return res.status(500).json({ message: "Could not upload cover image" });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { currentPassword, newPassword } = req.body ?? {};
    const result = await usersService.changePassword(
      req.userId,
      String(currentPassword ?? ""),
      String(newPassword ?? "")
    );
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return badUserId(res);
    const profile = await usersService.getPublicProfile(req.userId, userId);
    return res.json({ profile });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserPosts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return badUserId(res);
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const lang =
      typeof req.query.lang === "string"
        ? req.query.lang
        : undefined;
    const result = await postsService.listPosts({
      viewerId: req.userId,
      authorId: userId,
      page,
      limit,
      lang,
    });
    return res.json(result);
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserFollowers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return badUserId(res);
    const users = await usersService.listFollowers(userId, req.userId);
    return res.json({ users });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserFollowing = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return badUserId(res);
    const users = await usersService.listFollowing(userId, req.userId);
    return res.json({ users });
  } catch (err) {
    return handleError(res, err);
  }
};

export const getUserFriends = async (req: AuthRequest, res: Response) => {
  try {
    const userId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(userId)) return badUserId(res);
    const friends = await friendsService.listFriends(userId);
    return res.json({ friends });
  } catch (err) {
    return handleError(res, err);
  }
};
