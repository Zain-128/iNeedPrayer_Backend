import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import { dbConnect } from "./configs/db.connect.js";

const app = express();
app.use(express.json());

// Ensure DB is connected (needed for Vercel serverless; no-op after first connect)
let dbConnected = false;
app.use(async (_req, _res, next) => {
  if (!dbConnected) {
    try {
      await dbConnect();
      dbConnected = true;
    } catch (err) {
      console.error("DB connect error:", err);
    }
  }
  next();
});

app.use("/api/auth", authRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;