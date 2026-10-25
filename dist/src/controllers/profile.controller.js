import mongoose from "mongoose";
import * as usersService from "../services/users.service.js";
import * as postsService from "../services/posts.service.js";
import * as friendsService from "../services/friends.service.js";
import { pickUploadedFile, saveUploadedImage } from "../utils/imageUpload.js";
import { paramStr } from "../utils/routeParams.js";
function handleError(res, err) {
    const e = err;
    return res.status(e.statusCode ?? 500).json({ message: e.message });
}
function badUserId(res) {
    return res.status(400).json({ message: "Invalid user id" });
}
export const getMyProfile = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const profile = await usersService.getMyProfile(req.userId);
        return res.json({ profile });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const updateMyProfile = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const profile = await usersService.updateMe(req.userId, req.body ?? {});
        return res.json({ profile });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const uploadAvatar = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const file = pickUploadedFile(req.files);
        if (!file) {
            return res
                .status(400)
                .json({ message: 'No image file (use multipart field "image" or "file")' });
        }
        const saved = await saveUploadedImage(file.buffer, "avatar", file.mimetype);
        const profile = await usersService.updateMe(req.userId, {
            avatar: saved.url,
        });
        return res.status(201).json({ url: saved.url, profile });
    }
    catch (err) {
        console.error("uploadAvatar error:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Could not upload profile image",
            error: err.code || "UPLOAD_ERROR",
        });
    }
};
export const uploadCover = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const file = pickUploadedFile(req.files);
        if (!file) {
            return res
                .status(400)
                .json({ message: 'No image file (use multipart field "image" or "file")' });
        }
        const saved = await saveUploadedImage(file.buffer, "cover", file.mimetype);
        const profile = await usersService.updateMe(req.userId, {
            coverImage: saved.url,
        });
        return res.status(201).json({ url: saved.url, profile });
    }
    catch (err) {
        console.error("uploadCover error:", err);
        return res.status(400).json({
            success: false,
            message: err.message || "Could not upload cover image",
            error: err.code || "UPLOAD_ERROR",
        });
    }
};
export const changePassword = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const { currentPassword, newPassword } = req.body ?? {};
        const result = await usersService.changePassword(req.userId, String(currentPassword ?? ""), String(newPassword ?? ""));
        return res.json(result);
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const getUserProfile = async (req, res) => {
    try {
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(userId))
            return badUserId(res);
        const profile = await usersService.getPublicProfile(req.userId, userId);
        return res.json({ profile });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const getUserPosts = async (req, res) => {
    try {
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(userId))
            return badUserId(res);
        const page = req.query.page ? Number(req.query.page) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const lang = typeof req.query.lang === "string"
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
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const getUserFollowers = async (req, res) => {
    try {
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(userId))
            return badUserId(res);
        const users = await usersService.listFollowers(userId, req.userId);
        return res.json({ users });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const getUserFollowing = async (req, res) => {
    try {
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(userId))
            return badUserId(res);
        const users = await usersService.listFollowing(userId, req.userId);
        return res.json({ users });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const getUserFriends = async (req, res) => {
    try {
        const userId = paramStr(req.params.userId);
        if (!mongoose.isValidObjectId(userId))
            return badUserId(res);
        const friends = await friendsService.listFriends(userId);
        return res.json({ friends });
    }
    catch (err) {
        return handleError(res, err);
    }
};
