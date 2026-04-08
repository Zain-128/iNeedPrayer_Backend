/**
 * Vercel serverless entry: exports the Express app (no Socket.IO).
 * Local/production long-running server: use `yarn start` → server.ts
 */
import app from "../src/app.js";

export default app;
