# Chat Module — Frontend Developer Integration Guide (React Native)

**Project:** I Need Prayer Mobile Application  
**Platform:** Android & iOS (React Native / Redux Toolkit / Socket.IO)  
**Base URL:** `https://api.ineedprayer.world` (or local `http://localhost:5000`)  
**Auth Header:** `Authorization: Bearer <accessToken>`  

---

## 1. Summary of Changes for Frontend
The backend has been upgraded with 5 core chat features:
1. **Media Message Editing & Replacement:** Edit text or replace previously sent images, videos, audio, and documents on existing messages.
2. **Real-Time Edit & Delete Sync:** Socket.IO broadcast whenever a message is edited or deleted.
3. **Cursor-Based Infinite Scroll Pagination:** Fetch older messages efficiently via `cursor` and `limit`.
4. **Failed Message Retry & Idempotency:** Support for `clientMessageId` preventing duplicate messages on network retries.
5. **Real-Time Typing Indicators:** `typing:start`, `typing:stop`, and `typing:update` events with 4s auto-expiration on server.

---

## 2. Redux Toolkit Query (`chatApi.ts`) Updates

Update your `src/redux/services/chatApi.ts` endpoints:

```typescript
export type ChatMessage = {
  id: string;
  _id: string;
  conversationId: string;
  clientMessageId?: string | null;
  text: string;
  messageType: "text" | "image" | "video" | "audio" | "file" | "system";
  isEdited: boolean;
  editedAt?: string | null;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  sender: "me" | "other";
  senderUserId: string;
  senderName: string;
  senderAvatar: string;
  time: string;
  createdAt: string;
};

export type GetMessagesParams = {
  conversationId: string;
  limit?: number;
  cursor?: string;
  before?: string;
};

export type MessagesResponse = {
  messages: ChatMessage[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export type SendMessageBody = {
  conversationId: string;
  text: string;
  messageType?: "text" | "image" | "video" | "audio" | "file";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  clientMessageId?: string; // Idempotency key for retries
};

export type EditMessageBody = {
  conversationId: string;
  messageId: string;
  text?: string;
  messageType?: "text" | "image" | "video" | "audio" | "file";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
};

// Endpoints in chatApi
export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // 1. Get Messages with cursor pagination
    getConversationMessages: builder.query<MessagesResponse, GetMessagesParams>({
      query: ({ conversationId, limit = 50, cursor, before }) => ({
        url: `/api/conversations/${conversationId}/messages`,
        method: "GET",
        params: {
          limit,
          ...(cursor ? { cursor } : {}),
          ...(before ? { before } : {}),
        },
      }),
      providesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

    // 2. Send Message (supports clientMessageId retry)
    sendConversationMessage: builder.mutation<{ message: ChatMessage; isDuplicate?: boolean }, SendMessageBody>({
      query: ({ conversationId, ...body }) => ({
        url: `/api/conversations/${conversationId}/messages`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

    // 3. Edit / Replace Media Message
    editConversationMessage: builder.mutation<{ message: ChatMessage }, EditMessageBody>({
      query: ({ conversationId, messageId, ...body }) => ({
        url: `/api/conversations/${conversationId}/messages/${messageId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

    // 4. Delete Message
    deleteConversationMessage: builder.mutation<{ success: boolean; messageId: string }, { conversationId: string; messageId: string }>({
      query: ({ conversationId, messageId }) => ({
        url: `/api/conversations/${conversationId}/messages/${messageId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),
  }),
});

export const {
  useGetConversationMessagesQuery,
  useSendConversationMessageMutation,
  useEditConversationMessageMutation,
  useDeleteConversationMessageMutation,
} = chatApi;
```

---

## 3. Media Message Editing & Replacement UI Flow

### Flow:
1. User long-presses an image or document they previously sent (`sender === "me"`).
2. Taps **"Replace Media"** or **"Edit"**.
3. Mobile app opens image/file picker and uploads new file to CDN/storage.
4. Mobile calls `editConversationMessage`:
```typescript
await editMessage({
  conversationId,
  messageId,
  text: "Updated caption (optional)",
  messageType: "image", // or "video" / "file"
  fileUrl: uploadedUrl,
  fileName: pickedFile.name,
  fileSize: pickedFile.size,
  mimeType: pickedFile.type,
}).unwrap();
```
5. Message updates in-place for all users. The UI shows an **"Edited"** badge if `item.isEdited === true`.

---

## 4. Real-Time Socket.IO Synchronization

Connect Socket.IO: `const socket = io(SOCKET_URL, { auth: { token: accessToken } });`

### 4.1 Join / Leave Rooms
```typescript
useEffect(() => {
  if (!conversationId) return;
  socket.emit("join-chat", conversationId);

  return () => {
    socket.emit("leave-chat", conversationId);
  };
}, [conversationId]);
```

### 4.2 Socket Event Listeners

```typescript
useEffect(() => {
  // A. Message Edited / Media Replaced
  const handleMessageUpdated = (payload: {
    conversationId: string;
    messageId: string;
    message: ChatMessage;
  }) => {
    if (payload.conversationId !== currentConversationId) return;
    setMessages((prev) =>
      prev.map((msg) => (msg.id === payload.messageId || msg._id === payload.messageId ? payload.message : msg))
    );
  };

  // B. Message Deleted
  const handleMessageDeleted = (payload: { conversationId: string; messageId: string }) => {
    if (payload.conversationId !== currentConversationId) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== payload.messageId && msg._id !== payload.messageId));
  };

  // C. New Message Received
  const handleNewMessage = (newMsg: ChatMessage) => {
    setMessages((prev) => {
      // Deduplicate by clientMessageId or id
      if (prev.some((m) => (m.clientMessageId && m.clientMessageId === newMsg.clientMessageId) || m.id === newMsg.id)) {
        return prev;
      }
      return [...prev, newMsg];
    });
  };

  // D. Typing Indicator
  const handleTypingUpdate = (data: {
    conversationId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  }) => {
    if (data.conversationId !== currentConversationId) return;
    setTypingUsers((prev) => {
      const next = { ...prev };
      if (data.isTyping) {
        next[data.userId] = data.userName;
      } else {
        delete next[data.userId];
      }
      return next;
    });
  };

  socket.on("message:updated", handleMessageUpdated);
  socket.on("message:deleted", handleMessageDeleted);
  socket.on("new-message", handleNewMessage);
  socket.on("typing:update", handleTypingUpdate);

  return () => {
    socket.off("message:updated", handleMessageUpdated);
    socket.off("message:deleted", handleMessageDeleted);
    socket.off("new-message", handleNewMessage);
    socket.off("typing:update", handleTypingUpdate);
  };
}, [currentConversationId]);
```

---

## 5. Cursor Pagination (Scroll-Up / Load Older)

When user scrolls to the top of the chat list:

```typescript
const [nextCursor, setNextCursor] = useState<string | null>(null);
const [hasMore, setHasMore] = useState(true);
const [isLoadingOlder, setIsLoadingOlder] = useState(false);

const loadOlderMessages = async () => {
  if (!hasMore || isLoadingOlder || !nextCursor) return;
  setIsLoadingOlder(true);

  try {
    const res = await fetchOlderMessages({
      conversationId,
      limit: 30,
      cursor: nextCursor,
    }).unwrap();

    setMessages((prev) => [...res.messages, ...prev]);
    setNextCursor(res.pagination.nextCursor);
    setHasMore(res.pagination.hasMore);
  } finally {
    setIsLoadingOlder(false);
  }
};
```

---

## 6. Failed Message Retry & Idempotency Flow

### Sending with `clientMessageId`:
1. When user taps Send, create temporary message:
```typescript
const clientMessageId = `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

const optimisticMessage: ChatMessage = {
  id: clientMessageId,
  _id: clientMessageId,
  clientMessageId,
  conversationId,
  text: inputText,
  messageType: "text",
  isEdited: false,
  sender: "me",
  senderUserId: currentUserId,
  senderName: currentUserName,
  senderAvatar: currentUserAvatar,
  time: "Sending...",
  createdAt: new Date().toISOString(),
  status: "sending", // local state: "sending" | "sent" | "failed"
};

// Add to local state
setMessages((prev) => [...prev, optimisticMessage]);
```

2. Send API request:
```typescript
try {
  const result = await sendMessage({
    conversationId,
    clientMessageId,
    text: inputText,
    messageType: "text",
  }).unwrap();

  // Replace optimistic message with confirmed server message
  setMessages((prev) =>
    prev.map((m) => (m.clientMessageId === clientMessageId ? { ...result.message, status: "sent" } : m))
  );
} catch (error) {
  // Mark message as failed in UI
  setMessages((prev) =>
    prev.map((m) => (m.clientMessageId === clientMessageId ? { ...m, status: "failed" } : m))
  );
}
```

3. When user taps **"Retry"** on a failed message:
Call `sendMessage` with the **same `clientMessageId`**:
- If the server previously saved the message but the response was lost, the server returns the existing message without creating a duplicate!
- If the server never received it, it creates it normally.

---

## 7. Typing Indicator UI Flow

```typescript
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const handleInputChange = (text: string) => {
  setInputText(text);

  if (text.trim().length > 0) {
    socket.emit("typing:start", { conversationId });

    // Auto-stop after 2.5 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 2500);
  } else {
    socket.emit("typing:stop", { conversationId });
  }
};

const handleSend = () => {
  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  socket.emit("typing:stop", { conversationId });
  // Send message...
};
```

### Displaying Typing Status in Chat Header / Footer:
```typescript
const renderTypingIndicator = () => {
  const typingNames = Object.values(typingUsers);
  if (typingNames.length === 0) return null;

  let text = "";
  if (typingNames.length === 1) {
    text = `${typingNames[0]} is typing...`;
  } else if (typingNames.length === 2) {
    text = `${typingNames[0]} and ${typingNames[1]} are typing...`;
  } else {
    text = `${typingNames[0]} and ${typingNames.length - 1} others are typing...`;
  }

  return (
    <View style={styles.typingContainer}>
      <Text style={styles.typingText}>{text}</Text>
    </View>
  );
};
```

---

## 8. Summary of Socket.IO Events Reference

| Event Name | Direction | Payload |
| :--- | :--- | :--- |
| `typing:start` | Mobile -> Server | `{ "conversationId": "..." }` |
| `typing:stop` | Mobile -> Server | `{ "conversationId": "..." }` |
| `typing:update` | Server -> Mobile | `{ conversationId, userId, userName, userAvatar, isTyping }` |
| `message:updated` | Server -> Mobile | `{ conversationId, messageId, message }` |
| `message:deleted` | Server -> Mobile | `{ conversationId, messageId }` |
| `new-message` | Server -> Mobile | `{ id, text, messageType, fileUrl, clientMessageId, ... }` |
| `chat-updated` | Server -> Mobile | Updated conversation item for recents list |
