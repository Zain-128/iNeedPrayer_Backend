import mongoose from "mongoose";
const churchMemberSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    church: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Church",
        required: true,
    },
    role: {
        type: String,
        enum: ["owner", "admin", "member"],
        default: "member",
    },
}, { timestamps: true });
churchMemberSchema.index({ user: 1, church: 1 }, { unique: true });
churchMemberSchema.index({ church: 1 });
export const ChurchMember = mongoose.model("ChurchMember", churchMemberSchema);
