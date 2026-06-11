import mongoose from "mongoose";
import * as usersService from "../services/users.service.js";
function parseTargetUserId(body) {
    const userId = body?.userId;
    if (!userId || typeof userId !== "string")
        return null;
    if (!mongoose.isValidObjectId(userId))
        return null;
    return userId;
}
function parseProfileUserId(queryUserId, fallbackUserId) {
    if (queryUserId === undefined || queryUserId === "")
        return fallbackUserId;
    if (typeof queryUserId !== "string")
        return null;
    if (!mongoose.isValidObjectId(queryUserId))
        return null;
    return queryUserId;
}
function handleError(res, err) {
    const e = err;
    return res.status(e.statusCode ?? 500).json({ message: e.message });
}
export const follow = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const targetId = parseTargetUserId(req.body);
        if (!targetId)
            return res.status(400).json({ message: "userId is required" });
        const result = await usersService.followUser(req.userId, targetId);
        return res.json(result);
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const unfollow = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const targetId = parseTargetUserId(req.body);
        if (!targetId)
            return res.status(400).json({ message: "userId is required" });
        const result = await usersService.unfollowUser(req.userId, targetId);
        return res.json(result);
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const followers = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const profileUserId = parseProfileUserId(req.query.userId, req.userId);
        if (!profileUserId) {
            return res.status(400).json({ message: "Invalid userId" });
        }
        const users = await usersService.listFollowers(profileUserId, req.userId);
        return res.json({ users });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const following = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const profileUserId = parseProfileUserId(req.query.userId, req.userId);
        if (!profileUserId) {
            return res.status(400).json({ message: "Invalid userId" });
        }
        const users = await usersService.listFollowing(profileUserId, req.userId);
        return res.json({ users });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const block = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const blockedId = parseTargetUserId(req.body);
        if (!blockedId)
            return res.status(400).json({ message: "userId is required" });
        await usersService.blockUser(req.userId, blockedId);
        return res.json({ message: "Blocked" });
    }
    catch (err) {
        return handleError(res, err);
    }
};
export const unblock = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const blockedId = parseTargetUserId(req.body);
        if (!blockedId)
            return res.status(400).json({ message: "userId is required" });
        await usersService.unblockUser(req.userId, blockedId);
        return res.json({ message: "Unblocked" });
    }
    catch (err) {
        return handleError(res, err);
    }
};
