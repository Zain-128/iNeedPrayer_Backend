import { Response, NextFunction } from "express";
import { AuthRequest, protect } from "./auth.middleware.js";

/** Requires a valid access token AND user.role === "admin". */
export const protectAdmin = [
  protect,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = (req.user as { role?: string } | null | undefined)?.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    if ((req.user as { status?: string })?.status === "blocked") {
      return res.status(403).json({ message: "Account is blocked" });
    }
    next();
  },
];
