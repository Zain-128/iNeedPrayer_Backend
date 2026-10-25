import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../contants.js";
import { User } from "../models/user.model.js";
export const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ message: "Not authorized; no token" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }
        req.userId = decoded.userId;
        req.user = user;
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
