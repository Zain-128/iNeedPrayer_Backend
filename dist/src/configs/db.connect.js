import mongoose from "mongoose";
export const dbConnect = async () => {
    try {
        const uri = process.env.MONGO_URI ||
            process.env.MONGODB_URI ||
            "mongodb+srv://ineedprayerapp_db_user:YGQTdzac7zVcF4im@cluster0.xbnmoeg.mongodb.net/?appName=Cluster0";
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");
    }
    catch (error) {
        console.error("MongoDB connection failed:", error);
        throw error;
    }
};
