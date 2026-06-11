import mongoose from "mongoose";
import * as usersService from "../services/users.service.js";
function handleError(res, err) {
    const e = err;
    return res.status(e.statusCode ?? 500).json({ message: e.message });
}
export const checkBlockStatus = async (req, res) => {
    try {
        if (!req.userId)
            return res.status(401).json({ message: "Unauthorized" });
        const userId = typeof req.query.userId === "string" ? req.query.userId : "";
        if (!userId || !mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: "userId is required" });
        }
        const status = await usersService.getBlockStatus(req.userId, userId);
        return res.json(status);
    }
    catch (err) {
        return handleError(res, err);
    }
};
