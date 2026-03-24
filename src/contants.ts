import dotenv from "dotenv";
dotenv.config();
export const PORT = process.env.PORT || 3004;
export const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/iNeedPrayer";
export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/** Dev-style fixed reset code (no email). Change/remove before real production. */
export const PASSWORD_RESET_CODE = process.env.PASSWORD_RESET_CODE ?? "1234";
