import http from "http";
import type { Express } from "express";
import { Server } from "socket.io";
import { ALLOWED_ORIGINS } from "../contants.js";
import { setIo } from "./ioSingleton.js";
import { registerChatSocket } from "./chat.socket.js";

export function createHttpServerWithSocket(app: Express) {
  const httpServer = http.createServer(app);
  const corsOrigin = ALLOWED_ORIGINS?.length ? ALLOWED_ORIGINS : "*";
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });
  setIo(io);
  registerChatSocket(io);
  return httpServer;
}
