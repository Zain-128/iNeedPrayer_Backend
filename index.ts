import "./src/contants.js";
import express from "express";
import { dbConnect } from "./src/configs/db.connect.js";
import { PORT } from "./src/contants.js";
import authRoutes from "./src/routes/auth.routes.js";

const app = express();
app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const start = async () => {
  await dbConnect();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
