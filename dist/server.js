import "dotenv/config";
import "./src/contants.js";
import { B2_BUCKET, isB2Configured, PORT } from "./src/contants.js";
import app from "./src/app.js";
import { createHttpServerWithSocket } from "./src/socket/httpServer.js";
import { bootstrapActiveLiveSessions } from "./src/services/liveStream.service.js";
import { startLiveStreamStaleJob } from "./src/jobs/liveStreamStaleJob.js";
import { dbConnect } from "./src/configs/db.connect.js";
import { ensureAdminUser } from "./src/seed/seedAdminUser.js";
import { verifySmtp } from "./src/services/email/mailer.js";
const start = async () => {
    // Bind PORT first so Hostinger health checks do not 503 while Mongo connects.
    const httpServer = createHttpServerWithSocket(app);
    httpServer.listen(Number(PORT), () => {
        console.log(`HTTP + Socket.IO on port ${PORT}`);
    });
    void verifySmtp().then((r) => console.log(r.ok ? "[email] SMTP ready" : `[email] SMTP disabled: ${r.error}`));
    console.log(isB2Configured()
        ? `[upload] Images -> Backblaze B2 bucket "${B2_BUCKET}"`
        : "[upload] B2 not configured; images saved to local /uploads");
    try {
        await dbConnect();
        await ensureAdminUser();
        await bootstrapActiveLiveSessions();
        startLiveStreamStaleJob();
    }
    catch (err) {
        console.error("MongoDB connect failed; HTTP still listening:", err);
    }
};
start().catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
});
