import "./src/contants.js";
import { dbConnect } from "./src/configs/db.connect.js";
import { PORT } from "./src/contants.js";
import app from "./src/app.js";
import { createHttpServerWithSocket } from "./src/socket/httpServer.js";

const start = async () => {
  await dbConnect();
  const httpServer = createHttpServerWithSocket(app);
  httpServer.listen(Number(PORT), () => {
    console.log(`HTTP + Socket.IO on port ${PORT}`);
  });
};

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
