import agoraAccessToken from "agora-access-token";
import { AGORA_APP_CERTIFICATE, AGORA_APP_ID, AGORA_TOKEN_EXPIRY_SECONDS, } from "../contants.js";
const { RtcRole, RtcTokenBuilder } = agoraAccessToken;
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
export function assertAgoraConfigured() {
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
        throw httpError("Live streaming is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE.", 503);
    }
}
/** Stable numeric Agora UID from Mongo user id. */
export function uidFromUserId(userId) {
    const hex = userId.replace(/[^a-f0-9]/gi, "").slice(-8);
    const n = parseInt(hex || "1", 16);
    return (n % 2147483646) + 1;
}
export function buildChannelName(scope, entityId) {
    return `${scope}_${entityId}`;
}
export function buildRtcToken(channelName, uid, role) {
    assertAgoraConfigured();
    const rtcRole = role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expiresAt = Math.floor(Date.now() / 1000) + AGORA_TOKEN_EXPIRY_SECONDS;
    const token = RtcTokenBuilder.buildTokenWithUid(AGORA_APP_ID, AGORA_APP_CERTIFICATE, channelName, uid, rtcRole, expiresAt);
    return { token, uid, appId: AGORA_APP_ID, expiresAt };
}
