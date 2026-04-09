/**
 * Render (and some hosts) default to `node index.js` with Root Directory = `src`.
 * The real entry is `server.ts` at the repo root; tsx loads it.
 */
import { tsImport } from "tsx/esm/api";

await tsImport("../server.ts", import.meta.url);
