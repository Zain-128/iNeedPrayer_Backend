import { LIVE_HOST_HEARTBEAT_TIMEOUT_MS } from "../contants.js";
import { endStaleLiveSessions } from "../services/liveStream.service.js";

let timer: ReturnType<typeof setInterval> | null = null;

export function startLiveStreamStaleJob(intervalMs = 30_000) {
  if (timer) return;

  timer = setInterval(async () => {
    try {
      const ended = await endStaleLiveSessions(LIVE_HOST_HEARTBEAT_TIMEOUT_MS);
      if (ended > 0) {
        console.log(`[live] auto-ended ${ended} stale session(s)`);
      }
    } catch (e) {
      console.error("[live] stale session sweep failed:", e);
    }
  }, intervalMs);
}

export function stopLiveStreamStaleJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
