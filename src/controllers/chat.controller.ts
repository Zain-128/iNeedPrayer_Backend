import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth.middleware.js";
import * as chatService from "../services/chat.service.js";
import { paramStr } from "../utils/routeParams.js";
import { getIo } from "../socket/ioSingleton.js";
import {
  broadcastNewMessage,
  broadcastChatUpdated,
} from "../socket/chat.emit.js";

export const listConversations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const conversations = await chatService.listConversations(req.userId);
    return res.json({ conversations });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const openConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { peerUserId } = req.body ?? {};
    if (!peerUserId || typeof peerUserId !== "string") {
      return res.status(400).json({ message: "peerUserId required" });
    }
    const result = await chatService.getOrCreateConversation(
      req.userId,
      peerUserId
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const { title, memberIds, image } = req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "title required" });
    }
    if (!Array.isArray(memberIds)) {
      return res.status(400).json({ message: "memberIds must be an array" });
    }
    const result = await chatService.createGroupConversation(req.userId, {
      title,
      memberIds: memberIds.filter((x: unknown) => typeof x === "string"),
      image: typeof image === "string" ? image : undefined,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const leaveGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.leaveGroupConversation(id, req.userId);
    const io = getIo();
    if (io) {
      if (result.deleted && result.formerMemberIds?.length) {
        for (const uid of result.formerMemberIds) {
          io.to(`user:${uid}`).emit("conversation-deleted", {
            conversationId: id,
          });
        }
      } else if (!result.deleted) {
        await broadcastChatUpdated(io, id);
      }
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listMessages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const before =
      typeof req.query.before === "string" ? req.query.before : undefined;
    const messages = await chatService.listMessages(id, req.userId, {
      limit,
      before,
    });
    return res.json({ messages });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const { text, messageType } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text required" });
    }
    const persisted = await chatService.persistInboundChatMessage(
      id,
      req.userId,
      text,
      typeof messageType === "string" ? messageType : "text"
    );
    const io = getIo();
    if (io) {
      broadcastNewMessage(io, id, persisted.socketPayload);
      await broadcastChatUpdated(io, id);
    }
    return res.status(201).json({ message: persisted.restForSender });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const hideConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    await chatService.hideConversationForUser(req.userId, id);
    return res.json({ message: "Hidden" });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};
