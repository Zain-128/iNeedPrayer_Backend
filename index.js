// Some hosts default to `node index.js` at repo root; delegate to `server.ts`.
import { tsImport } from "tsx/esm/api";

await tsImport("./server.ts", import.meta.url);
