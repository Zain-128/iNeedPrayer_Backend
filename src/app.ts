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
import friendsRoutes from "./routes/friends.routes.js";
import blockRoutes from "./routes/block.routes.js";
import socialRoutes from "./routes/social.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import liveStreamRoutes from "./routes/liveStream.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { dbConnect } from "./configs/db.connect.js";
import { ALLOWED_ORIGINS, UPLOAD_ROOT, STRIPE_WEBHOOK_SECRET } from "./contants.js";
import { ensureUploadDir } from "./utils/ensureUploadDir.js";
import * as stripeService from "./services/stripe.service.js";
import type Stripe from "stripe";

const app = express();

void ensureUploadDir()
  .then(() => console.log(`Uploads dir ready: ${UPLOAD_ROOT}`))
  .catch((err) => console.error("Could not create uploads dir:", err));

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
    "Content-Type, Authorization, Stripe-Signature"
  );
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

/* ─── Stripe Webhook (raw body required — must be before express.json()) ─── */
if (STRIPE_WEBHOOK_SECRET) {
  app.post(
    "/api/webhook/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"] as string;
        const event = stripeService.constructWebhookEvent(
          req.body as Buffer,
          sig
        );

        switch (event.type) {
          case "checkout.session.completed":
            await stripeService.handleCheckoutCompleted(
              event.data.object as Stripe.Checkout.Session
            );
            break;
          case "customer.subscription.deleted":
            await stripeService.handleSubscriptionDeleted(
              event.data.object as Stripe.Subscription
            );
            break;
        }

        res.json({ received: true });
      } catch (err: any) {
        console.error("Stripe webhook error:", err.message);
        res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }
    }
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(UPLOAD_ROOT, {
    fallthrough: true,
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

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
app.use("/api/friends", friendsRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/live", liveStreamRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", socialRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;
