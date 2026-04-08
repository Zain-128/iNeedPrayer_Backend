import mongoose from "mongoose";

const uri = process.env.MONGO_URI;

/** Reuse connection across Vercel serverless invocations (warm instances). */
const g = globalThis as typeof globalThis & {
  __mongooseConn?: Promise<typeof mongoose>;
};

export const dbConnect = async (): Promise<void> => {
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (!g.__mongooseConn) {
    g.__mongooseConn = mongoose.connect(uri).then(() => mongoose);
  }
  try {
    await g.__mongooseConn;
    console.log("Connected to MongoDB");
  } catch (error) {
    g.__mongooseConn = undefined;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};