import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../contants.js";
/** Bearer must be an access token. Legacy tokens without `typ` count as access. */
export function verifyAccessToken(token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.typ === "refresh") {
        const err = new Error("Use access token, not refresh token");
        err.statusCode = 401;
        throw err;
    }
    if (!decoded.userId) {
        const err = new Error("Invalid token payload");
        err.statusCode = 401;
        throw err;
    }
    return { userId: decoded.userId };
}
