import mongoose from "mongoose";
import { MONGO_URI } from "../contants.js";

export const dbConnect = async () => {
  try {

    await mongoose.connect("mongodb+srv://zain_raza_dev:2ScoEBn3TKaTmLBm@cluster0.780ez.mongodb.net/?appName=Cluster0" as string);
    console.log("Connected to MongoDB" , process.env);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    throw error;
  }
};
