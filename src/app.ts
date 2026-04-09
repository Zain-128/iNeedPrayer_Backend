import "dotenv/config";
import express from "express";
import authRoutes from "./routes/auth.routes.js";
import testRoutes from "./routes/test.routes.js";
import postsRoutes from "./routes/posts.routes.js";
import commentsRoutes from "./routes/comments.routes.js";
import usersRoutes from "./routes/users.routes.js";
import churchesRoutes from "./routes/churches.routes.js";
import groupsRoutes from "./routes/groups.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { dbConnect } from "./configs/db.connect.js";
import { ALLOWED_ORIGINS, UPLOAD_ROOT } from "./contants.js";

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS?.length) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

app.use("/uploads", express.static(UPLOAD_ROOT));

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
app.use("/api/test", testRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/churches", churchesRoutes);
app.use("/api/groups", groupsRoutes);
app.use("/api/conversations", conversationsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/payment-methods", paymentRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;