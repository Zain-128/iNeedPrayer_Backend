# Chat Module — Development Requirements & Backend Implementation Guide

**Project:** I Need Prayer Mobile Application  
**Platform:** Android & iOS (React Native)  
**Technology Stack:** React Native, Node.js, Express.js, MongoDB, Socket.IO  
**Status:** Implemented & Verified in Backend  

---

## 1. Overview
This document provides complete implementation specifications for the 5 major chat improvements:
1. **Media Message Editing & Replacement**
2. **Real-Time Message Edit & Delete Synchronization**
3. **Cursor-Based Message Pagination & Chat History**
4. **Failed Message Retry & Idempotency (`clientMessageId`)**
5. **Real-Time Typing Indicators (`typing:start`, `typing:stop`, `typing:update`)**

---

## 2. Media Message Editing & Replacement

### 2.1 Feature Summary
Users can replace previously sent images, videos, audio, and documents within private and group conversations without deleting the original message.
- Preserves the original message ID, sender ID, and creation timestamp.
- Updates media URL, file metadata, message text/caption, and sets `isEdited: true` and `editedAt: Date`.
- Updates conversation's `lastMessageText` if this was the latest message in the conversation.
- Real-time broadcast via Socket.IO (`message:updated` and `message-edited`).

### 2.2 API Endpoint
- **Method & Route:** `PATCH /api/conversations/:conversationId/messages/:messageId`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body (JSON):**
```json
{
  "text": "Check out this updated photo",
  "messageType": "image",
  "fileUrl": "https://storage.example.com/updated-image.jpg",
  "fileName": "updated-image.jpg",
  "fileSize": 204800,
  "mimeType": "image/jpeg",
  "duration": 0
}
```
*Note:* The endpoint also accepts `text` containing the media URL directly (e.g. `{ "text": "https://...", "messageType": "image" }`).

### 2.3 Response (200 OK)
```json
{
  "message": {
    "id": "672b1234c77c68a4cb029999",
    "_id": "672b1234c77c68a4cb029999",
    "conversationId": "672b1000c77c68a4cb021111",
    "clientMessageId": "cmsg_1730880000000_abc",
    "text": "Check out this updated photo",
    "messageType": "image",
    "isEdited": true,
    "editedAt": "2026-11-06T10:00:00.000Z",
    "fileUrl": "https://storage.example.com/updated-image.jpg",
    "fileName": "updated-image.jpg",
    "fileSize": 204800,
    "mimeType": "image/jpeg",
    "duration": 0,
    "sender": "me",
    "senderUserId": "67210214c77c68a4cb0211a1",
    "senderName": "John Doe",
    "senderAvatar": "https://...",
    "time": "Just now",
    "createdAt": "2026-11-06T09:45:00.000Z"
  }
}
```

---

## 3. Real-Time Message Edit & Delete Synchronization

Whenever a user edits or deletes a message (via REST or WebSocket), all participants in the conversation room `chat:${conversationId}` receive instant Socket.IO updates.

### 3.1 Edit Synchronization
- **Server Broadcast Event:** `message:updated` (also emits legacy alias `message-edited`)
- **Broadcast Room:** `chat:${conversationId}`
- **Payload:**
```json
{
  "conversationId": "672b1000c77c68a4cb021111",
  "messageId": "672b1234c77c68a4cb029999",
  "message": {
    "id": "672b1234c77c68a4cb029999",
    "_id": "672b1234c77c68a4cb029999",
    "conversationId": "672b1000c77c68a4cb021111",
    "clientMessageId": "cmsg_1730880000000_abc",
    "text": "Check out this updated photo",
    "messageType": "image",
    "isEdited": true,
    "editedAt": "2026-11-06T10:00:00.000Z",
    "fileUrl": "https://storage.example.com/updated-image.jpg",
    "fileName": "updated-image.jpg",
    "fileSize": 204800,
    "mimeType": "image/jpeg",
    "duration": 0,
    "sender": "other",
    "senderUserId": "67210214c77c68a4cb0211a1",
    "senderName": "John Doe",
    "senderAvatar": "https://...",
    "time": "Just now",
    "createdAt": "2026-11-06T09:45:00.000Z"
  }
}
```

### 3.2 Delete Synchronization
- **Endpoint:** `DELETE /api/conversations/:conversationId/messages/:messageId`
- **Server Broadcast Event:** `message:deleted` (also emits legacy alias `message-deleted`)
- **Broadcast Room:** `chat:${conversationId}`
- **Payload:**
```json
{
  "conversationId": "672b1000c77c68a4cb021111",
  "messageId": "672b1234c77c68a4cb029999"
}
```
*Note on Conversation Preview:* When a message is deleted, the backend automatically looks up the new latest message and updates the conversation's `lastMessageText` and `lastMessageAt`, broadcasting `chat-updated` to conversation members.

---

## 4. Cursor-Based Pagination & Chat History

### 4.1 Feature Summary
Efficiently loads previous messages as users scroll upward without fetching the entire history.
- Avoids duplicates and off-by-one errors when new messages arrive.
- High-performance compound MongoDB indexes:
  - `{ conversation: 1, createdAt: -1, _id: -1 }`
- Backward compatible: returns `{ messages: [...], pagination: { hasMore, nextCursor } }`.

### 4.2 API Endpoint
- **Method & Route:** `GET /api/conversations/:conversationId/messages`
- **Query Parameters:**
  - `limit` (optional): Integer (default: 50, min: 1, max: 100)
  - `cursor` (optional): Message ID string of the oldest loaded message (or ISO timestamp)
  - `before` (optional): Alias for cursor (for existing mobile compatibility)
- **Example:**
  `GET /api/conversations/672b1000c77c68a4cb021111/messages?limit=30&cursor=672b1234c77c68a4cb029999`

### 4.3 Response (200 OK)
```json
{
  "messages": [
    {
      "id": "672b1234c77c68a4cb029990",
      "_id": "672b1234c77c68a4cb029990",
      "conversationId": "672b1000c77c68a4cb021111",
      "text": "Good morning everyone",
      "messageType": "text",
      "isEdited": false,
      "editedAt": null,
      "fileUrl": "",
      "sender": "other",
      "senderUserId": "67210214c77c68a4cb0211a2",
      "senderName": "Jane Smith",
      "senderAvatar": "https://...",
      "time": "2 hours ago",
      "createdAt": "2026-11-06T08:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "672b1234c77c68a4cb029990"
  }
}
```

---

## 5. Failed Message Retry & Idempotency

### 5.1 Idempotency Key: `clientMessageId`
To prevent duplicate messages when network issues occur or when the mobile app retries failed sends:
- Client generates a UUID / timestamp string: e.g. `cmsg_${Date.now()}_${random}`.
- Sent in `POST /api/conversations/:conversationId/messages` or Socket.IO `send-message`.
- If a message with `{ conversation, sender, clientMessageId }` already exists in MongoDB:
  - The server **does not create a duplicate**.
  - Returns the already-saved message object with `isDuplicate: true`.
  - Does **not** rebroadcast a duplicate `new-message` event to other participants.

### 5.2 Sending / Retrying via REST API
- **Endpoint:** `POST /api/conversations/:conversationId/messages`
- **Request Body:**
```json
{
  "clientMessageId": "cmsg_1730880123456_xyz",
  "text": "Praying for you today!",
  "messageType": "text"
}
```
- **Response (201 Created on first send, 200 OK on duplicate retry):**
```json
{
  "message": {
    "id": "672b1234c77c68a4cb028888",
    "_id": "672b1234c77c68a4cb028888",
    "conversationId": "672b1000c77c68a4cb021111",
    "clientMessageId": "cmsg_1730880123456_xyz",
    "text": "Praying for you today!",
    "messageType": "text",
    "isEdited": false,
    "editedAt": null,
    "sender": "me",
    "senderUserId": "67210214c77c68a4cb0211a1",
    "senderName": "John Doe",
    "senderAvatar": "https://...",
    "time": "Just now",
    "createdAt": "2026-11-06T10:15:00.000Z"
  },
  "isDuplicate": false
}
```

---

## 6. Real-Time Typing Indicator

### 6.1 Workflow & Architecture
- **In-Memory Expiration:** The server tracks typing state per user per conversation.
- **Auto-Expiration:** Inactive indicators expire automatically after **4 seconds** if `typing:stop` is not sent.
- **Auto-Clear:** Typing state is automatically cleared when the user sends a message (`send-message` or REST API), leaves the conversation, or disconnects.
- **Authorization:** Only authenticated members of the conversation can emit typing events.

### 6.2 Socket.IO Events

#### 1. Client to Server
| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `typing:start` (or `typing-start`) | `conversationId` or `{ "conversationId": "..." }` | User started typing |
| `typing:stop` (or `typing-stop`) | `conversationId` or `{ "conversationId": "..." }` | User stopped typing |

#### 2. Server to Client Broadcast
- **Event:** `typing:update` (also emits legacy `user-typing` / `user-stop-typing`)
- **Broadcast Scope:** Emitted to `socket.to("chat:" + conversationId)` (excludes the sender)
- **Payload:**
```json
{
  "conversationId": "672b1000c77c68a4cb021111",
  "userId": "67210214c77c68a4cb0211a1",
  "userName": "John Doe",
  "userAvatar": "https://...",
  "isTyping": true
}
```

### 6.3 React Native Frontend Integration Example
```typescript
// When text input changes
const onTextChange = (text: string) => {
  setInputText(text);
  
  if (text.length > 0) {
    socket.emit("typing:start", { conversationId });
    
    // Clear previous timer and stop typing after 2.5 seconds of inactivity
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing:stop", { conversationId });
    }, 2500);
  } else {
    socket.emit("typing:stop", { conversationId });
  }
};

// When sending message
const onSendMessage = () => {
  socket.emit("typing:stop", { conversationId });
  // Send message...
};

// Listen for typing updates
useEffect(() => {
  const handleTyping = (data: {
    conversationId: string;
    userId: string;
    userName: string;
    isTyping: boolean;
  }) => {
    if (data.conversationId !== currentConversationId) return;
    
    setTypingUsers(prev => {
      const next = { ...prev };
      if (data.isTyping) {
        next[data.userId] = data.userName;
      } else {
        delete next[data.userId];
      }
      return next;
    });
  };

  socket.on("typing:update", handleTyping);
  return () => {
    socket.off("typing:update", handleTyping);
  };
}, [currentConversationId]);
```

---

## 7. Socket.IO Event Reference Summary

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `send-message` | Client -> Server | `{ conversationId, text, messageType, fileUrl, clientMessageId }` | Send inbound message |
| `new-message` / `message:created` | Server -> Room | Full message socket payload | Real-time new message broadcast |
| `message-sent` | Server -> Sender | `{ message, isDuplicate }` | Confirmation for sender socket |
| `message:edit` / `edit-message` | Client -> Server | `{ conversationId, messageId, text, messageType, fileUrl }` | Socket-based message edit |
| `message:updated` / `message-edited` | Server -> Room | `{ conversationId, messageId, message }` | Real-time edit notification |
| `message:delete` / `delete-message` | Client -> Server | `{ conversationId, messageId }` | Socket-based message delete |
| `message:deleted` / `message-deleted` | Server -> Room | `{ conversationId, messageId }` | Real-time delete notification |
| `typing:start` | Client -> Server | `{ conversationId }` | Start typing |
| `typing:stop` | Client -> Server | `{ conversationId }` | Stop typing |
| `typing:update` | Server -> Room | `{ conversationId, userId, userName, userAvatar, isTyping }` | Real-time typing status |
| `chat-updated` | Server -> User | Updated `ConversationListItem` | Conversation recents sync |
