# I Need Prayer — Master Frontend API Documentation & Integration Guide

**Platform:** Android & iOS (React Native)  
**Backend Technology:** Node.js, Express.js, MongoDB, Socket.IO  
**Base URL:** `https://api.ineedprayer.world` *(Local Dev: `http://localhost:5000`)*  
**Global Auth Header:** `Authorization: Bearer <accessToken>`  
**Content-Type:** `application/json`  
**Date:** November 2026  
**Status:** All endpoints implemented, tested, and live in backend.

---

## Table of Contents
1. [Chat Module Improvements](#1-chat-module-improvements)
   - 1.1 [Send Message with Idempotency & Retry (`clientMessageId`)](#11-send-message-with-idempotency--retry-clientmessageid)
   - 1.2 [Media Message Editing & Replacement](#12-media-message-editing--replacement)
   - 1.3 [Cursor-Based Pagination & Chat History](#13-cursor-based-pagination--chat-history)
   - 1.4 [Delete Message](#14-delete-message)
   - 1.5 [Real-Time Socket.IO Synchronization (Typing, Edits, Deletes)](#15-real-time-socketio-synchronization)
   - 1.6 [Ready-to-use RTK Query (`chatApi.ts`) Code](#16-ready-to-use-rtk-query-chatapits-code)
2. [Message Request System (Non-Friends Messaging)](#2-message-request-system-non-friends-messaging)
   - 2.1 [Send Initial Message Request (1-Message Rule)](#21-send-initial-message-request-1-message-rule)
   - 2.2 [List Message Requests](#22-list-message-requests)
   - 2.3 [Accept Message Request](#23-accept-message-request)
   - 2.4 [Decline Message Request](#24-decline-message-request)
   - 2.5 [Conversation Details with Permission Flags](#25-conversation-details-with-permission-flags)
3. [Church Module Management](#3-church-module-management)
   - 3.1 [Church Follow Invitations](#31-church-follow-invitations)
   - 3.2 [Church Staff & Role Permissions (`Owner`, `Admin`, `Editor`)](#32-church-staff--role-permissions)
   - 3.3 [Church Events CRUD](#33-church-events-crud)
   - 3.4 [Church Live Stream Settings](#34-church-live-stream-settings)
4. [Community / Group Management](#4-community--group-management)
   - 4.1 [Public & Private Membership](#41-public--private-membership)
   - 4.2 [Sent Join Requests (User Tab)](#42-sent-join-requests-user-tab)
   - 4.3 [Cancel Join Request](#43-cancel-join-request)
   - 4.4 [Incoming Join Requests (Admin Approval/Rejection)](#44-incoming-join-requests-admin-approvalrejection)
   - 4.5 [Community Live Stream Settings](#45-community-live-stream-settings)
5. [Shared Live Stream Settings](#5-shared-live-stream-settings)

---

# 1. Chat Module Improvements

## 1.1 Send Message with Idempotency & Retry (`clientMessageId`)
Allows the app to send messages and safely retry failed messages without creating duplicate records.
- **Method & Route:** `POST /api/conversations/:conversationId/messages`
- **Request Body:**
```json
{
  "clientMessageId": "cmsg_1730880123456_xyz",
  "text": "Hello there!",
  "messageType": "text",
  "fileUrl": "",
  "fileName": "",
  "fileSize": 0,
  "mimeType": "",
  "duration": 0
}
```
- **Response (201 Created on first send; 200 OK on duplicate retry):**
```json
{
  "message": {
    "id": "672b1234c77c68a4cb028888",
    "_id": "672b1234c77c68a4cb028888",
    "conversationId": "672b1000c77c68a4cb021111",
    "clientMessageId": "cmsg_1730880123456_xyz",
    "text": "Hello there!",
    "messageType": "text",
    "isEdited": false,
    "editedAt": null,
    "fileUrl": "",
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

## 1.2 Media Message Editing & Replacement
Users can edit captions or replace previously sent images, videos, audio, or documents without deleting the original message.
- **Method & Route:** `PATCH /api/conversations/:conversationId/messages/:messageId`
- **Request Body:**
```json
{
  "text": "Check out this updated photo",
  "messageType": "image",
  "fileUrl": "https://cdn.ineedprayer.world/uploads/updated_photo.jpg",
  "fileName": "updated_photo.jpg",
  "fileSize": 204800,
  "mimeType": "image/jpeg",
  "duration": 0
}
```
*Note: Also accepts URL directly inside `text`.*
- **Response (200 OK):**
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
    "editedAt": "2026-11-06T10:20:00.000Z",
    "fileUrl": "https://cdn.ineedprayer.world/uploads/updated_photo.jpg",
    "fileName": "updated_photo.jpg",
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

## 1.3 Cursor-Based Pagination & Chat History
Loads older messages when scrolling upwards.
- **Method & Route:** `GET /api/conversations/:conversationId/messages`
- **Query Params:**
  - `limit`: Number of messages (default: 50, max: 100)
  - `cursor`: Oldest loaded message ID (pass `pagination.nextCursor` from prior response)
  - `before`: Legacy alias for `cursor`
- **Example:** `GET /api/conversations/672b1000c77c68a4cb021111/messages?limit=30&cursor=672b1234c77c68a4cb029999`
- **Response (200 OK):**
```json
{
  "messages": [
    {
      "id": "672b1234c77c68a4cb029990",
      "_id": "672b1234c77c68a4cb029990",
      "conversationId": "672b1000c77c68a4cb021111",
      "clientMessageId": "cmsg_1730880000000_aaa",
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

## 1.4 Delete Message
- **Method & Route:** `DELETE /api/conversations/:conversationId/messages/:messageId`
- **Response (200 OK):**
```json
{
  "success": true,
  "conversationId": "672b1000c77c68a4cb021111",
  "messageId": "672b1234c77c68a4cb029999"
}
```

---

## 1.5 Real-Time Socket.IO Synchronization

Connect: `io(SOCKET_URL, { auth: { token: accessToken } })`

### Events Emitted by Mobile App:
| Event | Payload | Action |
| :--- | :--- | :--- |
| `join-chat` | `conversationId` | Join room `chat:${conversationId}` |
| `leave-chat` | `conversationId` | Leave room |
| `typing:start` | `conversationId` *(or `{ "conversationId": "..." }`)* | Starts typing indicator (auto-expires in 4s on server) |
| `typing:stop` | `conversationId` *(or `{ "conversationId": "..." }`)* | Stops typing indicator |
| `send-message` | `{ conversationId, text, messageType, fileUrl, clientMessageId }` | Send message over socket |
| `message:edit` | `{ conversationId, messageId, text, messageType, fileUrl }` | Edit/replace media over socket |
| `message:delete` | `{ conversationId, messageId }` | Delete message over socket |

### Events Received by Mobile App:
| Event | Payload | Action |
| :--- | :--- | :--- |
| `typing:update` | `{ conversationId, userId, userName, userAvatar, isTyping: boolean }` | Show/hide typing indicator |
| `message:updated` | `{ conversationId, messageId, message: ChatMessage }` | Update message in chat list |
| `message:deleted` | `{ conversationId, messageId }` | Remove message from chat list |
| `new-message` | `ChatMessage` | Append incoming message |
| `chat-updated` | Updated `ConversationListItem` | Update recents list item & snippet |

---

## 1.6 Ready-to-use RTK Query (`chatApi.ts`) Code

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

export type MessagesResponse = {
  messages: ChatMessage[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
};

export const chatApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getConversationMessages: builder.query<MessagesResponse, { conversationId: string; limit?: number; cursor?: string; before?: string }>({
      query: ({ conversationId, limit = 50, cursor, before }) => ({
        url: `/api/conversations/${conversationId}/messages`,
        method: "GET",
        params: { limit, ...(cursor ? { cursor } : {}), ...(before ? { before } : {}) },
      }),
      providesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

    sendConversationMessage: builder.mutation<{ message: ChatMessage; isDuplicate?: boolean }, { conversationId: string; text: string; messageType?: string; fileUrl?: string; fileName?: string; fileSize?: number; mimeType?: string; duration?: number; clientMessageId?: string }>({
      query: ({ conversationId, ...body }) => ({
        url: `/api/conversations/${conversationId}/messages`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

    editConversationMessage: builder.mutation<{ message: ChatMessage }, { conversationId: string; messageId: string; text?: string; messageType?: string; fileUrl?: string; fileName?: string; fileSize?: number; mimeType?: string; duration?: number }>({
      query: ({ conversationId, messageId, ...body }) => ({
        url: `/api/conversations/${conversationId}/messages/${messageId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_res, _err, arg) => [{ type: "Chat", id: arg.conversationId }],
    }),

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

# 2. Message Request System (Non-Friends Messaging)

## 2.1 Send Initial Message Request (1-Message Rule)
- **Method & Route:** `POST /api/conversations/requests` *(or `/api/conversations/message-requests`)*
- **Request Body:**
```json
{
  "recipientId": "67210214c77c68a4cb0211a2",
  "text": "Hello, I wanted to reach out regarding prayer."
}
```
- **Success Response (201 Created):**
```json
{
  "message": "Message request sent successfully",
  "conversationId": "672b1000c77c68a4cb021111",
  "status": "pending",
  "requestStatus": "pending",
  "chatMessage": { ... }
}
```
- **Error Response (403 Forbidden):**
```json
{
  "message": "Cannot send additional messages until your message request is accepted"
}
```

---

## 2.2 List Message Requests
- **Endpoints:**
  - `GET /api/conversations/requests` *(default tab: incoming)*
  - `GET /api/conversations/requests?tab=incoming`
  - `GET /api/conversations/requests?tab=outgoing`
  - `GET /api/conversations/requests/incoming`
  - `GET /api/conversations/requests/outgoing`
- **Response (200 OK):**
```json
{
  "requests": [
    {
      "id": "672b1000c77c68a4cb021111",
      "_id": "672b1000c77c68a4cb021111",
      "conversationId": "672b1000c77c68a4cb021111",
      "isGroup": false,
      "peer": {
        "id": "67210214c77c68a4cb0211a1",
        "name": "David Miller",
        "avatar": "https://..."
      },
      "peerUser": {
        "id": "67210214c77c68a4cb0211a1",
        "name": "David Miller",
        "avatar": "https://..."
      },
      "title": "David Miller",
      "avatar": "https://...",
      "lastMessage": "Hello, I wanted to reach out...",
      "lastMessageText": "Hello, I wanted to reach out...",
      "time": "10m ago",
      "status": "pending",
      "requestStatus": "pending",
      "requestedBy": "67210214c77c68a4cb0211a1",
      "isRequest": true,
      "canSendMessages": false
    }
  ],
  "conversations": [...]
}
```

---

## 2.3 Accept Message Request
Moves chat to regular Recents list and unlocks unrestricted messaging for both users.
- **Endpoints:**
  - `POST /api/conversations/:id/accept`
  - `POST /api/conversations/requests/:id/accept`
- **Response (200 OK):**
```json
{
  "success": true,
  "conversationId": "672b1000c77c68a4cb021111",
  "status": "accepted",
  "requestStatus": "accepted"
}
```

---

## 2.4 Decline Message Request
- **Endpoints:**
  - `POST /api/conversations/:id/decline`
  - `POST /api/conversations/requests/:id/decline`
- **Response (200 OK):**
```json
{
  "success": true,
  "conversationId": "672b1000c77c68a4cb021111",
  "status": "declined",
  "requestStatus": "declined"
}
```

---

## 2.5 Conversation Details with Permission Flags
- **Method & Route:** `GET /api/conversations/:id`
- **Response (200 OK):**
```json
{
  "id": "672b1000c77c68a4cb021111",
  "_id": "672b1000c77c68a4cb021111",
  "conversationId": "672b1000c77c68a4cb021111",
  "kind": "direct",
  "isGroup": false,
  "title": "",
  "status": "pending",
  "requestStatus": "pending",
  "requestedBy": "67210214c77c68a4cb0211a1",
  "canSendMessages": false,
  "members": [...],
  "createdAt": "2026-11-06T09:45:00.000Z"
}
```

---

# 3. Church Module Management

## 3.1 Church Follow Invitations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/churches/:id/invite-candidates` | Eligible friends to invite (supports `?q=search`) |
| `GET` | `/api/churches/:id/follow-invites` | Invitations sent by church (`?status=all\|pending\|accepted`) |
| `GET` | `/api/churches/follow-invites/received` | Invitations received by current user |
| `POST` | `/api/churches/:id/invite` | Batch invite users (`{ "userIds": ["id1", "id2"] }`) |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/accept` | Recipient accepts invitation and follows church |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/decline` | Recipient declines invitation |
| `DELETE` | `/api/churches/:id/follow-invites/:inviteId` | Staff cancels pending invitation |
| `POST` | `/api/churches/:id/follow-invites/:inviteId/resend` | Staff resends invitation |
| `POST` | `/api/churches/:id/follow` | Toggle follow / unfollow |
| `POST` | `/api/churches/:id/unfollow` | Unfollow church |

#### Batch Invite Example:
`POST /api/churches/:id/invite`
```json
{
  "userIds": ["67210214c77c68a4cb0211a1", "67210214c77c68a4cb0211a2"]
}
```
**Response (200 OK):** `{ "message": "Invitations sent successfully", "invited": 2 }`

---

## 3.2 Church Staff & Role Permissions
Roles supported: `owner`, `admin`, `editor`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/churches/:id/permissions` | User's role and permission flags |
| `GET` | `/api/churches/:id/role-limits` | Staff limits and remaining slots based on subscription |
| `GET` | `/api/churches/:id/staff` | List Owner, Admins, and Editors |
| `POST` | `/api/churches/:id/staff` | Add staff member (`{ "userId": "...", "role": "admin"|"editor" }`) |
| `PATCH` | `/api/churches/:id/staff/:userId` | Update role (`{ "role": "admin"|"editor" }`) |
| `DELETE` | `/api/churches/:id/staff/:userId` | Remove staff member |

#### Permissions Response (`GET /api/churches/:id/permissions`):
```json
{
  "role": "owner",
  "permissions": {
    "isOwner": true,
    "canEditChurch": true,
    "canManageAdmins": true,
    "canManageEditors": true,
    "canManageFollowers": true,
    "canManageInvitations": true,
    "canManageEvents": true,
    "canManagePosts": true,
    "canManageLiveStreams": true,
    "canAccessAnalytics": true,
    "canManageWallet": true,
    "canManageWithdrawals": true,
    "canDeleteChurch": true
  }
}
```

---

## 3.3 Church Events CRUD
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/churches/:id/events` | List events (`?filter=upcoming\|past\|all&page=1&limit=20`) |
| `POST` | `/api/churches/:id/events` | Create new event (notifies followers) |
| `GET` | `/api/churches/:id/events/:eventId` | Get event details |
| `PATCH` | `/api/churches/:id/events/:eventId` | Update church event |
| `DELETE` | `/api/churches/:id/events/:eventId` | Delete church event |

#### Create Event Body (`POST /api/churches/:id/events`):
```json
{
  "title": "Sunday Worship Service",
  "description": "Join us for worship and prayer.",
  "eventDate": "2026-11-15T10:00:00.000Z",
  "startTime": "10:00",
  "endTime": "12:00",
  "timezone": "America/Chicago",
  "location": "Main Church Hall",
  "eventType": "in_person",
  "coverImage": "https://cdn.ineedprayer.world/events/sunday_service.jpg",
  "status": "published"
}
```

---

## 3.4 Church Live Stream Settings
- `GET /api/churches/:id/live-settings`
- `PATCH /api/churches/:id/live-settings`

#### Update Body:
```json
{
  "enabled": true,
  "allowedRoles": ["owner", "admin"],
  "liveChatEnabled": true,
  "superChatsEnabled": true,
  "donationsEnabled": true,
  "reactionsEnabled": true,
  "replayEnabled": true,
  "moderationEnabled": true
}
```

---

# 4. Community / Group Management

## 4.1 Public & Private Membership
- `POST /api/groups/:id/join`: Direct join for Public groups; creates pending join request for Private groups.
- `POST /api/groups/:id/leave`: Leave group.
- `PATCH /api/groups/:id/privacy`: Update group privacy (`public` / `private`).

---

## 4.2 Sent Join Requests (User Tab)
- **Method & Route:** `GET /api/groups/join-requests/sent`
- **Response (200 OK):**
```json
{
  "requests": [
    {
      "id": "67210214c77c68a4cb021155",
      "groupId": "67210214c77c68a4cb021144",
      "groupName": "Faith & Prayer Community",
      "groupImage": "https://cdn.ineedprayer.world/groups/faith.jpg",
      "status": "pending",
      "requestedAt": "2026-11-02T10:00:00.000Z"
    }
  ]
}
```

---

## 4.3 Cancel Join Request
- `DELETE /api/groups/:id/join-request` (cancel by group ID)
- `DELETE /api/groups/join-requests/:requestId` (cancel by request ID)

---

## 4.4 Incoming Join Requests (Admin Approval/Rejection)
- **List incoming requests:** `GET /api/groups/:id/pending-join-requests`
- **Approve request:** `POST /api/groups/:id/join-requests/:userId/approve` *(also accepts `:requestId`)*
- **Reject request:** `POST /api/groups/:id/join-requests/:userId/reject` *(also accepts `:requestId`)*

---

## 4.5 Community Live Stream Settings
- `GET /api/groups/:id/live-settings`
- `PATCH /api/groups/:id/live-settings`

---

# 5. Shared Live Stream Settings
Supports both church and group configurations through a unified endpoint:
- **Retrieve:** `GET /api/live-stream/settings?sourceType=church&sourceId=:id` *(or `sourceType=group`)*
- **Update:** `PATCH /api/live-stream/settings`
```json
{
  "sourceType": "church",
  "sourceId": "67210214c77c68a4cb021188",
  "settings": {
    "enabled": true,
    "allowedRoles": ["owner", "admin"],
    "liveChatEnabled": true,
    "superChatsEnabled": true,
    "donationsEnabled": true,
    "reactionsEnabled": true,
    "replayEnabled": true,
    "moderationEnabled": true
  }
}
```
*(Also mounted on alias `/api/live/settings`).*
