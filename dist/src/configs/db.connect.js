import mongoose from "mongoose";
import { MONGO_URI } from "../contants.js";
export const dbConnect = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Connected to MongoDB");
    }
    catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
};
