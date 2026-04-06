// Render (and some hosts) run `node src/index.js`; the real app lives in `server.ts`.
import { tsImport } from "tsx/esm/api";

await tsImport("../server.ts", import.meta.url);
