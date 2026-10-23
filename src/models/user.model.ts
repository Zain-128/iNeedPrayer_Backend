import mongoose from "mongoose";
import bcrypt from "bcrypt";

export interface IUser {
  email: string;
  password: string;
  name: string;
  avatar: string;
  coverImage: string;
  bio: string;
  preferredLanguage: string | null;
  city: string;
  state: string;
  country: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  socialId?: string | null;
  provider?: string | null;
  socialLoginProvider?: string | null;
  socialLoginId?: string | null;
  passwordResetCodeHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  passwordResetRequestedAt?: Date | null;
  passwordResetAttempts?: number;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 500 },
    // null = never chosen, so the app can keep its device-detected language
    preferredLanguage: { type: String, default: null },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    socialId: { type: String, default: null },
    provider: { type: String, default: null },
    socialLoginProvider: { type: String, default: null },
    socialLoginId: { type: String, default: null },
    /** sha256 of the emailed one-time reset code (never the code itself). */
    passwordResetCodeHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    passwordResetRequestedAt: { type: Date, default: null, select: false },
    passwordResetAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>("User", userSchema);
