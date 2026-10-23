# Frontend API Documentation: Photo & Video Post Support

This document outlines the API updates for uploading videos and managing single/multiple photos & videos in Posts.

---

## 1. Media Upload Endpoints

### A. Video Upload Endpoint
- **Route**: `POST /api/upload/video`
- **Headers**:
  - `Authorization: Bearer <user_token>`
  - `Content-Type: multipart/form-data`
- **Accepted Multipart Form Fields**:
  - `file` *(Recommended for React Native / mobile)*
  - `video`
  - `media`
  - `files`
- **Supported Formats**: `MP4`, `MOV`, `WebM`, `3GP`, `AVI`, `MKV` (Max size: 100MB)
- **Query Parameter (Optional)**: `?kind=post`
- **Response `201 Created`**:
```json
{
  "kind": "post",
  "mediaType": "video",
  "storage": "local",
  "url": "/uploads/1727733440-abc123def456.mp4",
  "absoluteUrl": "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-abc123def456.mp4"
}
```

---

### B. Image Upload Endpoint
- **Route**: `POST /api/upload/image`
- **Headers**:
  - `Authorization: Bearer <user_token>`
  - `Content-Type: multipart/form-data`
- **Accepted Multipart Form Fields**:
  - `file` *(Recommended for React Native / mobile)*
  - `image`
  - `media`
  - `files`
- **Supported Formats**: `JPEG`, `PNG`, `WebP`, `GIF` (Max size: 10MB)
- **Response `201 Created`**:
```json
{
  "kind": "post",
  "mediaType": "image",
  "storage": "local",
  "url": "/uploads/1727733440-xyz789.jpg",
  "absoluteUrl": "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-xyz789.jpg"
}
```

---

### C. General Media Upload Endpoint
- **Route**: `POST /api/upload/media`
- Automatically detects whether the uploaded file is an image or video.
- **Accepted Multipart Form Fields**: `file`, `video`, `image`, `media`, `files`.

---

## 2. Creating & Updating Posts

### A. Create Post (`POST /api/posts`)
Send JSON body with photo(s) and/or video(s):

```json
{
  "text": "Check out my prayer update!",
  "mode": "prayer",
  "images": [
    "/uploads/1727733440-photo1.jpg",
    "/uploads/1727733440-photo2.jpg"
  ],
  "video": "/uploads/1727733440-video.mp4",
  "videos": [
    "/uploads/1727733440-video.mp4"
  ]
}
```

> **Note**:
> - `images` accepts an array of strings (urls).
> - Single `image` field (string) is still fully supported for backwards compatibility.
> - `videos` accepts an array of video strings (urls).
> - Single `video` field (string) is also supported.

---

### B. Update Post (`PATCH /api/posts/:id`)
```json
{
  "text": "Updated post text",
  "images": ["/uploads/new_photo.jpg"],
  "video": "/uploads/new_video.mp4"
}
```

---

## 3. Post Response Structure (`GET /api/posts`, `GET /api/posts/:id`, etc.)

All post responses return both single fields (`image`, `video`) and array fields (`images`, `videos`) fully resolved:

```json
{
  "post": {
    "id": "66f4b321a9c3d123456789ab",
    "author": {
      "id": "66f1a111a9c3d12345678900",
      "name": "Shawn Torres",
      "avatar": "https://dimgrey-mink-558336.hostingersite.com/uploads/avatar.jpg"
    },
    "text": "Check out my prayer update!",
    "image": "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-photo1.jpg",
    "images": [
      "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-photo1.jpg",
      "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-photo2.jpg"
    ],
    "video": "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-video.mp4",
    "videos": [
      "https://dimgrey-mink-558336.hostingersite.com/uploads/1727733440-video.mp4"
    ],
    "mode": "prayer",
    "stats": {
      "prays": 5,
      "praises": 2,
      "likes": 12,
      "comments": 3,
      "shares": 1
    }
  }
}
```
