/**
 * Hostinger loads this file via require() (lsnode.js).
 * Do not use top-level await here — use compiled JS from dist/ instead.
 */
import("./dist/server.js").catch((err) => {
  console.error("Failed to start app:", err);
  process.exit(1);
});
