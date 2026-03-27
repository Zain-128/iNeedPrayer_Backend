import mongoose from "mongoose";
import bcrypt from "bcrypt";

export interface IUser {
  email: string;
  password: string;
  name: string;
  avatar: string;
  city: string;
  state: string;
  country: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  socialLoginProvider?: string | null;
  socialLoginId?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postsCount: { type: Number, default: 0 },
    socialLoginProvider: { type: String, default: null },
    socialLoginId: { type: String, default: null },
  },
  { timestamps: true }
);

userSchema.index(
  { socialLoginProvider: 1, socialLoginId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      socialLoginId: { $exists: true, $type: "string", $ne: "" },
    },
  }
);

userSchema.virtual("locationLabel").get(function () {
  const parts = [this.city, this.state, this.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "";
});

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
