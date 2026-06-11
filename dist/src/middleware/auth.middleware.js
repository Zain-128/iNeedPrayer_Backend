import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../utils/jwt.util.js";
export const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ message: "Not authorized; no token" });
    }
    try {
        const { userId } = verifyAccessToken(token);
        const user = await User.findById(userId);
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        req.userId = userId;
        req.user = user;
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
