import mongoose from "mongoose";
import { MONGO_URI } from "../contants.js";

export const dbConnect = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not set. Configure it in .env");
    }
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};
