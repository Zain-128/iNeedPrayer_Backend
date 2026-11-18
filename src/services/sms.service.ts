import {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  isTwilioConfigured,
} from "../contants.js";

export interface SendSmsResult {
  success: boolean;
  sid?: string;
  error?: string;
  simulated?: boolean;
}

/**
 * Normalizes phone number to international E.164 format if possible.
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = (phone || "").replace(/[\s\-\(\)\.]/g, "").trim();
  if (!cleaned) return "";
  if (!cleaned.startsWith("+")) {
    // If 10 digits (US/Canada), prepend +1
    if (cleaned.length === 10) {
      cleaned = `+1${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

/**
 * Sends an SMS message using Twilio REST API.
 * Gracefully falls back to console simulation if Twilio is not configured.
 */
export async function sendSms(
  to: string,
  body: string
): Promise<SendSmsResult> {
  const formattedTo = formatPhoneNumber(to);
  if (!formattedTo) {
    return { success: false, error: "Recipient phone number is invalid or empty." };
  }

  if (!isTwilioConfigured()) {
    console.log(
      `[SMS SIMULATED] To: ${formattedTo} | From: ${TWILIO_PHONE_NUMBER || "TWILIO_NOT_CONFIGURED"} | Message: "${body}"`
    );
    return {
      success: true,
      simulated: true,
      sid: `sim-${Date.now()}`,
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: formattedTo,
      From: TWILIO_PHONE_NUMBER,
      Body: body,
    });

    const authHeader = `Basic ${Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
    ).toString("base64")}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as any;

    if (!res.ok) {
      const errMessage = data?.message || `HTTP ${res.status}`;
      console.warn(`[SMS] Twilio failed for ${formattedTo} (Code: ${data?.code}): ${errMessage}`);
      return { success: false, error: errMessage };
    }

    console.log(`[SMS] Successfully dispatched to ${formattedTo} (SID: ${data.sid})`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    const errMessage = err?.message || String(err);
    console.error(`[SMS] Error sending to ${formattedTo}:`, errMessage);
    return { success: false, error: errMessage };
  }
}

/**
 * Sends a standard verification code SMS.
 */
export async function sendVerificationSms(
  to: string,
  code: string,
  serviceName: string = "I Need Prayer"
): Promise<SendSmsResult> {
  const body = `Your verification code for ${serviceName} is: ${code}. This code is valid for 15 minutes.`;
  return sendSms(to, body);
}
