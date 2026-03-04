import "./src/contants.js";
import { dbConnect } from "./src/configs/db.connect.js";
import { PORT } from "./src/contants.js";
import app from "./src/app.js";

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
