import jwt from "jsonwebtoken";
import { User, IUser } from "../models/user.model.js";
import { JWT_SECRET, JWT_EXPIRES_IN } from "../contants.js";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: Omit<IUser, "password"> & { _id: string };
  token: string;
}

export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) {
    const err = new Error("User already exists with this email");
    (err as Error & { statusCode?: number }).statusCode = 409;
    throw err;
  }
  const user = await User.create({
    email: input.email.toLowerCase(),
    password: input.password,
    name: input.name,
  });
  const token = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const userObj = user.toObject();
  const { password: _, ...userWithoutPassword } = userObj;
  return {
    user: userWithoutPassword as AuthResult["user"],
    token,
  };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+password"
  );
  if (!user) {
    const err = new Error("Invalid email or password");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  const match = await user.comparePassword(input.password);
  if (!match) {
    const err = new Error("Invalid email or password");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
  const token = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  const userObj = user.toObject();
  const { password: _, ...userWithoutPassword } = userObj;
  return {
    user: userWithoutPassword as AuthResult["user"],
    token,
  };
};

export const getMe = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("User not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  return user;
};
