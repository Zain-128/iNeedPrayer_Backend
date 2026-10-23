import mongoose from "mongoose";
const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
        required: true,
        index: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    text: { type: String, required: true, trim: true, maxlength: 8000 },
    messageType: {
        type: String,
        enum: ["text", "image", "video", "audio", "file", "system"],
        default: "text",
    },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    duration: { type: Number, default: 0 },
}, { timestamps: true });
messageSchema.index({ conversation: 1, createdAt: -1 });
export const Message = mongoose.model("Message", messageSchema);
