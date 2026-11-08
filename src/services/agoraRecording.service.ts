import {
  AGORA_APP_ID,
  AGORA_CUSTOMER_ID,
  AGORA_CUSTOMER_SECRET,
  AGORA_RECORDING_VENDOR,
  AGORA_RECORDING_REGION,
  AGORA_RECORDING_BUCKET,
  AGORA_RECORDING_ACCESS_KEY,
  AGORA_RECORDING_SECRET_KEY,
  AGORA_RECORDING_PUBLIC_BASE_URL,
} from "../contants.js";
import { buildRtcToken } from "./agora.service.js";
import { ILiveStreamSession, LiveStreamSession } from "../models/liveStreamSession.model.js";
import mongoose from "mongoose";

const RECORDING_UID_NUM = 999001;
const RECORDING_UID_STR = "999001";

function isRecordingConfigured(): boolean {
  return Boolean(
    AGORA_APP_ID &&
      AGORA_CUSTOMER_ID &&
      AGORA_CUSTOMER_SECRET &&
      AGORA_RECORDING_BUCKET &&
      AGORA_RECORDING_ACCESS_KEY &&
      AGORA_RECORDING_SECRET_KEY
  );
}

function getAuthHeader(): string {
  const credentials = `${AGORA_CUSTOMER_ID}:${AGORA_CUSTOMER_SECRET}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

const AGORA_API_BASE = "https://api.agora.io/v1/apps";

export interface RecordingStartResult {
  resourceId: string;
  sid: string;
}

export interface RecordingStopResult {
  resourceId: string;
  sid: string;
  fileList?: string | string[];
  replayUrl?: string | null;
}

/**
 * Step 1: Acquire resource ID from Agora Cloud Recording API
 */
export async function acquireRecordingResource(
  channelName: string,
  recordingUid: string = RECORDING_UID_STR
): Promise<string> {
  const url = `${AGORA_API_BASE}/${AGORA_APP_ID}/cloud_recording/acquire`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cname: channelName,
      uid: recordingUid,
      clientRequest: {
        resourceExpiredHour: 24,
        scene: 0,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[AgoraRecording] Acquire failed (status ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as { resourceId: string };
  return data.resourceId;
}

/**
 * Step 2: Start Cloud Recording in mix_stream mode
 */
export async function startCloudRecording(
  resourceId: string,
  channelName: string,
  recordingUid: string = RECORDING_UID_STR
): Promise<RecordingStartResult> {
  const tokenData = buildRtcToken(channelName, RECORDING_UID_NUM, "subscriber");

  const url = `${AGORA_API_BASE}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/mode/mix_stream/start`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cname: channelName,
      uid: recordingUid,
      clientRequest: {
        token: tokenData.token,
        recordingConfig: {
          maxIdleTime: 30,
          streamTypes: 2, // Audio + Video
          channelType: 1, // Live Broadcasting
          videoStreamType: 0,
          subscribeAudioUids: ["#allstream#"],
          subscribeVideoUids: ["#allstream#"],
          subscribeUidGroup: 0,
          transcodingConfig: {
            width: 720,
            height: 1280,
            fps: 30,
            bitrate: 1500,
            mixedVideoLayout: 1,
            backgroundColor: "#000000",
          },
        },
        recordingFileConfig: {
          avFileType: ["hls", "mp4"],
        },
        storageConfig: {
          vendor: AGORA_RECORDING_VENDOR,
          region: AGORA_RECORDING_REGION,
          bucket: AGORA_RECORDING_BUCKET,
          accessKey: AGORA_RECORDING_ACCESS_KEY,
          secretKey: AGORA_RECORDING_SECRET_KEY,
          fileNamePrefix: ["recordings", channelName],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[AgoraRecording] Start failed (status ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as { resourceId: string; sid: string };
  return { resourceId: data.resourceId, sid: data.sid };
}

/**
 * Step 3: Stop Cloud Recording and retrieve recorded files
 */
export async function stopCloudRecording(
  resourceId: string,
  sid: string,
  channelName: string,
  recordingUid: string = RECORDING_UID_STR
): Promise<RecordingStopResult> {
  const url = `${AGORA_API_BASE}/${AGORA_APP_ID}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix_stream/stop`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cname: channelName,
      uid: recordingUid,
      clientRequest: {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `[AgoraRecording] Stop failed (status ${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    resourceId: string;
    sid: string;
    serverResponse?: {
      fileList?: string | string[];
      fileListMode?: string;
      uploadingStatus?: string;
    };
  };

  const fileList = data.serverResponse?.fileList;
  let replayUrl: string | null = null;

  if (fileList) {
    const primaryFile = Array.isArray(fileList) ? fileList[0] : fileList;
    if (primaryFile && AGORA_RECORDING_PUBLIC_BASE_URL) {
      replayUrl = `${AGORA_RECORDING_PUBLIC_BASE_URL}/${primaryFile.replace(/^\//, "")}`;
    } else if (primaryFile) {
      replayUrl = primaryFile;
    }
  }

  return {
    resourceId: data.resourceId,
    sid: data.sid,
    fileList,
    replayUrl,
  };
}

/**
 * Safe helper: Tries to acquire and start cloud recording without breaking stream if unconfigured
 */
export async function tryStartCloudRecording(
  session: mongoose.Document & ILiveStreamSession & { _id: mongoose.Types.ObjectId }
): Promise<void> {
  if (!isRecordingConfigured()) {
    console.log(
      "[AgoraRecording] AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET or storage not configured. Cloud recording skipped."
    );
    return;
  }

  try {
    session.recordingStatus = "acquiring";
    await session.save();

    const resourceId = await acquireRecordingResource(session.channelName);
    session.recordingResourceId = resourceId;

    const { sid } = await startCloudRecording(resourceId, session.channelName);
    session.recordingSid = sid;
    session.recordingStatus = "recording";
    await session.save();

    console.log(
      `[AgoraRecording] Started recording for channel: ${session.channelName}, sid: ${sid}`
    );
  } catch (err) {
    console.warn("[AgoraRecording] Failed to start cloud recording:", err);
    try {
      session.recordingStatus = "failed";
      await session.save();
    } catch {
      // Ignore DB save error on teardown
    }
  }
}

/**
 * Safe helper: Tries to stop cloud recording when stream ends
 */
export async function tryStopCloudRecording(
  session: mongoose.Document & ILiveStreamSession & { _id: mongoose.Types.ObjectId }
): Promise<void> {
  if (
    !session.recordingResourceId ||
    !session.recordingSid ||
    session.recordingStatus !== "recording"
  ) {
    return;
  }

  try {
    const result = await stopCloudRecording(
      session.recordingResourceId,
      session.recordingSid,
      session.channelName
    );

    session.recordingStatus = "stopped";
    if (result.replayUrl) {
      session.replayUrl = result.replayUrl;
    }
    await session.save();

    console.log(
      `[AgoraRecording] Stopped recording for channel: ${session.channelName}, replayUrl: ${result.replayUrl}`
    );
  } catch (err) {
    console.warn("[AgoraRecording] Failed to stop cloud recording:", err);
    try {
      session.recordingStatus = "failed";
      await session.save();
    } catch {
      // Ignore DB save error
    }
  }
}
