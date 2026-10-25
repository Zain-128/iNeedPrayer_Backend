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
    const tab = (typeof req.query.tab === "string" ? req.query.tab : "current") as
      | "current"
      | "archived"
      | "requests";
    const conversations = await chatService.listConversations(req.userId, { tab });
    return res.json({ conversations });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listRequests = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const requests = await chatService.listConversations(req.userId, {
      tab: "requests",
    });
    return res.json({ requests, conversations: requests });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const listArchived = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const archived = await chatService.listConversations(req.userId, {
      tab: "archived",
    });
    return res.json({ archived, conversations: archived });
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const result = await chatService.getUnreadMessagesCount(req.userId);
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const openConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const peerUserId = req.body?.peerUserId || req.body?.userId;
    if (
      !peerUserId ||
      typeof peerUserId !== "string" ||
      !mongoose.isValidObjectId(peerUserId)
    ) {
      return res.status(400).json({ message: "Valid peerUserId required" });
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
    const { title, memberIds, image, description, privacy, groupId } =
      req.body ?? {};
    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "title required" });
    }
    const parsedMemberIds = Array.isArray(memberIds)
      ? memberIds.filter((x: unknown) => typeof x === "string")
      : [];
    const result = await chatService.createGroupConversation(req.userId, {
      title,
      memberIds: parsedMemberIds,
      image: typeof image === "string" ? image : undefined,
      description: typeof description === "string" ? description : undefined,
      privacy: typeof privacy === "string" ? privacy : undefined,
      groupId: typeof groupId === "string" ? groupId : undefined,
    });
    return res.status(201).json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const getConversationDetails = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const details = await chatService.getConversationDetails(id, req.userId);
    return res.json(details);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const { title, image, description, privacy } = req.body ?? {};
    const result = await chatService.updateGroupConversation(id, req.userId, {
      title: typeof title === "string" ? title : undefined,
      image: typeof image === "string" ? image : undefined,
      description: typeof description === "string" ? description : undefined,
      privacy: typeof privacy === "string" ? privacy : undefined,
    });
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const addMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const rawIds = Array.isArray(req.body?.memberIds)
      ? req.body.memberIds
      : req.body?.userId
      ? [req.body.userId]
      : [];
    const memberIds = rawIds.filter((x: unknown) => typeof x === "string");
    const result = await chatService.addMembersToGroup(id, req.userId, memberIds);
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const targetUserId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.removeMemberFromGroup(
      id,
      req.userId,
      targetUserId
    );
    const io = getIo();
    if (io) {
      if (result.deleted) {
        io.to(`user:${targetUserId}`).emit("conversation-deleted", {
          conversationId: id,
        });
        io.to(`user:${req.userId}`).emit("conversation-deleted", {
          conversationId: id,
        });
      } else {
        io.to(`user:${targetUserId}`).emit("conversation-deleted", {
          conversationId: id,
        });
        await broadcastChatUpdated(io, id);
      }
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const promoteAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const targetUserId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.promoteToAdmin(
      id,
      req.userId,
      targetUserId
    );
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const demoteAdmin = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const targetUserId = paramStr(req.params.userId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.demoteAdmin(
      id,
      req.userId,
      targetUserId
    );
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
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

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.markConversationRead(id, req.userId);
    const io = getIo();
    if (io) {
      io.to(`chat:${id}`).emit("conversation-read", {
        conversationId: id,
        userId: req.userId,
      });
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const acceptRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.acceptMessageRequest(id, req.userId);
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const declineRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.declineMessageRequest(id, req.userId);
    const io = getIo();
    if (io) {
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const archiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const archiveState =
      req.body?.archived !== undefined ? Boolean(req.body.archived) : true;
    const result = await chatService.archiveConversation(
      id,
      req.userId,
      archiveState
    );
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const muteConversation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const muted = req.body?.muted !== undefined ? Boolean(req.body.muted) : true;
    const durationMinutes =
      req.body?.durationMinutes !== undefined
        ? Number(req.body.durationMinutes)
        : undefined;
    const result = await chatService.muteConversation(
      id,
      req.userId,
      muted,
      durationMinutes
    );
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
    const {
      text,
      messageType,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      duration,
      metadata,
    } = req.body ?? {};

    const effectiveFileUrl =
      typeof fileUrl === "string" && fileUrl.trim()
        ? fileUrl.trim()
        : typeof metadata?.fileUrl === "string"
        ? metadata.fileUrl.trim()
        : "";

    const hasText = typeof text === "string" && text.trim().length > 0;
    if (!hasText && !effectiveFileUrl) {
      return res.status(400).json({ message: "text or media required" });
    }

    const persisted = await chatService.persistInboundChatMessage(
      id,
      req.userId,
      typeof text === "string" ? text : "",
      typeof messageType === "string" ? messageType : "text",
      {
        fileUrl: effectiveFileUrl,
        fileName:
          typeof fileName === "string"
            ? fileName
            : typeof metadata?.fileName === "string"
            ? metadata.fileName
            : "",
        fileSize:
          typeof fileSize === "number"
            ? fileSize
            : typeof metadata?.fileSize === "number"
            ? metadata.fileSize
            : 0,
        mimeType:
          typeof mimeType === "string"
            ? mimeType
            : typeof metadata?.mimeType === "string"
            ? metadata.mimeType
            : "",
        duration:
          typeof duration === "number"
            ? duration
            : typeof metadata?.duration === "number"
            ? metadata.duration
            : 0,
      }
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

export const editMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const messageId = paramStr(req.params.messageId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }
    const result = await chatService.editMessage(
      id,
      messageId,
      req.userId,
      text.trim()
    );
    const io = getIo();
    if (io) {
      io.to(`chat:${id}`).emit("message-edited", {
        conversationId: id,
        message: result,
      });
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    return res.status(e.statusCode ?? 500).json({ message: e.message });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = paramStr(req.params.id);
    const messageId = paramStr(req.params.messageId);
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const result = await chatService.deleteMessage(id, messageId, req.userId);
    const io = getIo();
    if (io) {
      io.to(`chat:${id}`).emit("message-deleted", {
        conversationId: id,
        messageId,
      });
      await broadcastChatUpdated(io, id);
    }
    return res.json(result);
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
