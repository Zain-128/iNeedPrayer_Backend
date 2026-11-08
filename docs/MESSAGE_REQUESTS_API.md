# I Need Prayer — Message Request System API Documentation

## 1. Overview
The Message Request System allows users to communicate with people who are not on their friends list while maintaining privacy and preventing unwanted messages.

- **Non-friend rule:** When messaging a non-friend, a direct conversation is created with status `"pending"`.
- **1 Initial message limit:** The sender can send exactly **one initial text message**. Subsequent messages are blocked with HTTP `403 Forbidden` (`"Cannot send additional messages until your message request is accepted"`).
- **Separation of Concerns:** Accepting a message request does **NOT** make users friends. Friend requests and message requests are completely independent features.
- **Recipient Inbox Privacy:** Pending message requests do not appear in the recipient's regular chat list; they appear exclusively in `Chat -> Message Requests`.
- **Declined Request Protection:** If a request is declined, the sender cannot send any further messages (HTTP `403 Forbidden`).

---

## 2. API Endpoints

### 2.1 Send Initial Message Request
Creates or opens a conversation and sends the initial message in one step.
- **Endpoint:** `POST /api/conversations/requests` (or `POST /api/conversations/message-requests`)
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "recipientId": "664fa1...",
  "text": "Hello, I wanted to reach out regarding the prayer group."
}
```
- **Success Response (201 Created):**
```json
{
  "message": "Message request sent successfully",
  "conversationId": "6724...",
  "status": "pending",
  "requestStatus": "pending",
  "chatMessage": {
    "id": "6725...",
    "text": "Hello, I wanted to reach out regarding the prayer group.",
    "messageType": "text",
    "sender": "me",
    "senderUserId": "664fa1...",
    "senderName": "Sender Name",
    "senderAvatar": "https://...",
    "time": "Just now",
    "createdAt": "2026-11-02T02:30:00.000Z"
  }
}
```
- **Error Response (403 Forbidden - Already sent / pending):**
```json
{
  "message": "Cannot send additional messages until your message request is accepted"
}
```
- **Error Response (403 Forbidden - Previously declined):**
```json
{
  "message": "This message request was declined. You cannot send additional messages."
}
```

---

### 2.2 List Message Requests
Fetches pending message requests for the current user.
- **Endpoints:**
  - `GET /api/conversations/requests` (query param `tab=incoming` [default], `outgoing`, or `all`)
  - `GET /api/conversations/requests/incoming`
  - `GET /api/conversations/requests/outgoing`
  - `GET /api/conversations/message-requests`
- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `tab` (optional): `incoming` | `outgoing` | `all`
- **Success Response (200 OK):**
```json
{
  "requests": [
    {
      "id": "6724...",
      "_id": "6724...",
      "conversationId": "6724...",
      "isGroup": false,
      "peer": {
        "id": "664fa1...",
        "name": "Jane Doe",
        "avatar": "https://..."
      },
      "peerUser": {
        "id": "664fa1...",
        "name": "Jane Doe",
        "avatar": "https://..."
      },
      "title": "Jane Doe",
      "avatar": "https://...",
      "lastMessage": "Hello, I wanted to reach out...",
      "lastMessageText": "Hello, I wanted to reach out...",
      "time": "5m ago",
      "lastMessageAt": "2026-11-02T02:25:00.000Z",
      "unreadCount": 1,
      "isArchived": false,
      "isMuted": false,
      "status": "pending",
      "requestStatus": "pending",
      "requestedBy": "664fa1...",
      "isRequest": true,
      "canSendMessages": false
    }
  ],
  "conversations": [...]
}
```

---

### 2.3 Accept Message Request
Accepts an incoming message request. Moves conversation to standard Recents chat list for both users and unlocks full messaging.
- **Endpoints:**
  - `POST /api/conversations/:id/accept`
  - `POST /api/conversations/requests/:id/accept`
  - `POST /api/conversations/message-requests/:id/accept`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "conversationId": "6724...",
  "status": "accepted",
  "requestStatus": "accepted"
}
```
- **Security Check:** If sender attempts to accept their own outgoing request:
```json
{
  "message": "You cannot accept your own message request"
}
```

---

### 2.4 Decline Message Request
Declines an incoming message request. The conversation disappears from recipient's requests and blocks sender from sending additional messages.
- **Endpoints:**
  - `POST /api/conversations/:id/decline`
  - `POST /api/conversations/requests/:id/decline`
  - `POST /api/conversations/message-requests/:id/decline`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (200 OK):**
```json
{
  "success": true,
  "conversationId": "6724...",
  "status": "declined",
  "requestStatus": "declined"
}
```
- **Security Check:** If sender attempts to decline their own outgoing request:
```json
{
  "message": "You cannot decline your own message request"
}
```

---

### 2.5 Get Conversation Details
- **Endpoint:** `GET /api/conversations/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response (200 OK):**
```json
{
  "id": "6724...",
  "_id": "6724...",
  "conversationId": "6724...",
  "kind": "direct",
  "isGroup": false,
  "title": "",
  "image": "",
  "avatar": "",
  "status": "pending",
  "requestStatus": "pending",
  "requestedBy": "664fa1...",
  "canSendMessages": false,
  "members": [...],
  "membersCount": 2,
  "createdAt": "2026-11-02T02:25:00.000Z"
}
```

---

## 3. Real-time WebSocket Events (Socket.io)
When a request is updated or created, the server broadcasts:
- `new-message-request` emitted to `user:<recipientId>` with `{ conversationId, status }`
- `message-request-accepted` emitted to `chat:<conversationId>` with `{ success: true, conversationId, status: "accepted" }`
- `message-request-declined` emitted to `chat:<conversationId>` with `{ success: true, conversationId, status: "declined" }`
- `chat-updated` emitted to both member rooms `user:<userId>` with the populated `ConversationListItem`.
