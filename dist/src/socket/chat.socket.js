import { verifyAccessToken } from "../utils/jwt.util.js";
import { Conversation } from "../models/conversation.model.js";
import { User } from "../models/user.model.js";
import { persistInboundChatMessage } from "../services/chat.service.js";
import { broadcastNewMessage, broadcastChatUpdated } from "./chat.emit.js";
const userProfileCache = new Map();
const USER_PROFILE_CACHE_MS = 5 * 60_000;
async function loadUserProfile(userId) {
    const cached = userProfileCache.get(userId);
    if (cached && Date.now() - cached.at < USER_PROFILE_CACHE_MS) {
        return cached;
    }
    const user = await User.findById(userId).select("name avatar").lean();
    const profile = {
        name: user?.name ?? "User",
        avatar: user?.avatar ?? "",
        at: Date.now(),
    };
    userProfileCache.set(userId, profile);
    return profile;
}
export function registerChatSocket(io) {
    io.use(async (socket, next) => {
        const t = socket.handshake.auth?.token ??
            socket.handshake.query?.token;
        const raw = Array.isArray(t) ? t[0] : t;
        if (!raw || typeof raw !== "string") {
            return next(new Error("auth_required"));
        }
        try {
            const { userId } = verifyAccessToken(raw);
            const profile = await loadUserProfile(userId);
            const data = socket.data;
            data.userId = userId;
            data.userName = profile.name;
            data.userAvatar = profile.avatar;
            next();
        }
        catch {
            next(new Error("auth_invalid"));
        }
    });
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        socket.on("user-online", (uid) => {
            if (String(uid) !== userId)
                return;
            socket.join(`user:${userId}`);
        });
        socket.on("join-chat", async (conversationId) => {
            const id = typeof conversationId === "string" ? conversationId : "";
            if (!id)
                return;
            const conv = await Conversation.findById(id);
            if (!conv || !conv.members.some((m) => m.toString() === userId)) {
                socket.emit("message-error", { message: "Cannot join this chat" });
                return;
            }
            socket.join(`chat:${id}`);
        });
        socket.on("leave-chat", (conversationId) => {
            const id = typeof conversationId === "string" ? conversationId : "";
            if (id)
                socket.leave(`chat:${id}`);
        });
        socket.on("typing-start", (conversationId) => {
            const id = typeof conversationId === "string" ? conversationId : "";
            if (!id)
                return;
            socket.to(`chat:${id}`).emit("user-typing", {
                conversationId: id,
                userId,
                userName: socket.data?.userName || "Someone",
            });
        });
        socket.on("typing-stop", (conversationId) => {
            const id = typeof conversationId === "string" ? conversationId : "";
            if (!id)
                return;
            socket.to(`chat:${id}`).emit("user-stop-typing", {
                conversationId: id,
                userId,
            });
        });
        socket.on("send-message", async (data) => {
            try {
                const conversationId = data?.conversationId ?? data?.chatId;
                const text = data?.text ?? data?.content ?? "";
                const effectiveFileUrl = typeof data?.fileUrl === "string" && data.fileUrl.trim()
                    ? data.fileUrl.trim()
                    : typeof data?.metadata?.fileUrl === "string"
                        ? data.metadata.fileUrl.trim()
                        : "";
                if (!conversationId || (!String(text).trim() && !effectiveFileUrl)) {
                    socket.emit("message-error", {
                        message: "Missing conversationId, text, or media",
                    });
                    return;
                }
                const persisted = await persistInboundChatMessage(conversationId, userId, String(text), data?.messageType || "text", {
                    fileUrl: effectiveFileUrl,
                    fileName: data?.fileName ?? data?.metadata?.fileName ?? "",
                    fileSize: data?.fileSize ?? data?.metadata?.fileSize ?? 0,
                    mimeType: data?.mimeType ?? data?.metadata?.mimeType ?? "",
                    duration: data?.duration ?? data?.metadata?.duration ?? 0,
                });
                broadcastNewMessage(io, conversationId, persisted.socketPayload);
                await broadcastChatUpdated(io, conversationId);
            }
            catch (e) {
                socket.emit("message-error", {
                    message: e.message ?? "Failed to send",
                });
            }
        });
    });
}
