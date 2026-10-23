import mongoose from "mongoose";

const churchPlacesCacheSchema = new mongoose.Schema(
  {
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude] GeoJSON
        required: true,
      },
    },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    radius: { type: Number, required: true, default: 10000 },
    query: { type: String, default: "", lowercase: true, trim: true },
    rankPreference: { type: String, default: "POPULARITY" },
    churches: { type: Array, default: [] },
    count: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // 7 days TTL
  },
  { timestamps: true }
);

churchPlacesCacheSchema.index({ location: "2dsphere" });
churchPlacesCacheSchema.index({ latitude: 1, longitude: 1, radius: 1, query: 1 });

export const ChurchPlacesCache = mongoose.model(
  "ChurchPlacesCache",
  churchPlacesCacheSchema
);
