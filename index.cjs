"use strict";
/**
 * Hostinger lsnode.js require()s the entry file. With "type": "module",
 * index.js is ESM and require() fails — this CJS wrapper loads dist/server.js.
 */
const { join } = require("node:path");
const { pathToFileURL } = require("node:url");

import(pathToFileURL(join(__dirname, "dist", "server.js")).href).catch((err) => {
  console.error("Failed to start app:", err);
  process.exit(1);
});
