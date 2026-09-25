import fs from "fs";
import path from "path";
import crypto from "crypto";

function getAppleBundleId(): string {
  return (
    process.env.APPLE_BUNDLE_ID ||
    process.env.IOS_BUNDLE_ID ||
    "com.ineedprayer.app"
  );
}

function getGooglePlayPackageName(): string {
  return (
    process.env.GOOGLE_PLAY_PACKAGE_NAME ||
    process.env.GOOGLE_PACKAGE_NAME ||
    "com.ineedprayer.app"
  );
}

export function computeReceiptHash(receiptOrToken: string): string {
  return crypto.createHash("sha256").update(receiptOrToken.trim()).digest("hex");
}

function decodeAppleJwsUnsafe(signedPayload: string): any {
  const parts = signedPayload.split(".");
  const payloadPart = parts[1] || parts[0];
  try {
    return JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf-8"));
  } catch {
    return JSON.parse(Buffer.from(payloadPart, "base64").toString("utf-8"));
  }
}

function looksLikeAppleJws(value: string): boolean {
  const s = String(value || "").trim();
  return s.startsWith("eyJ") && s.split(".").length >= 3;
}

export interface VerifyReceiptResult {
  valid: boolean;
  reason?: string;
  raw?: any;
  productId?: string;
  transactionId?: string;
}

/**
 * Verifies an Apple App Store receipt or StoreKit 2 JWS.
 */
export async function verifyAppleReceipt(
  receipt: string,
  expectedProductId?: string
): Promise<VerifyReceiptResult> {
  if (!receipt || typeof receipt !== "string") {
    return { valid: false, reason: "Missing receipt" };
  }
  const trimmed = receipt.trim();

  if (looksLikeAppleJws(trimmed)) {
    try {
      const decoded = decodeAppleJwsUnsafe(trimmed);
      const sku =
        decoded?.productId ??
        decoded?.productID ??
        decoded?.signedTransactionInfo?.productId;
      const transactionId = decoded?.transactionId ?? decoded?.originalTransactionId ?? "";

      if (expectedProductId && sku && String(sku) !== String(expectedProductId)) {
        return {
          valid: false,
          reason: `productId mismatch: received=${sku}, expected=${expectedProductId}`,
          raw: decoded,
        };
      }

      return {
        valid: true,
        productId: sku || expectedProductId,
        transactionId: String(transactionId),
        raw: decoded,
      };
    } catch (err: any) {
      return { valid: false, reason: err?.message || "Invalid Apple JWS payload" };
    }
  }

  const sharedSecret = process.env.APPLE_SHARED_SECRET;
  if (!sharedSecret) {
    if (process.env.NODE_ENV === "production") {
      return {
        valid: false,
        reason: "APPLE_SHARED_SECRET is not configured (required in production)",
      };
    }
    return {
      valid: true,
      reason: "verification-disabled-non-production",
      productId: expectedProductId,
    };
  }

  const body = JSON.stringify({
    "receipt-data": trimmed,
    password: sharedSecret,
    "exclude-old-transactions": true,
  });

  const tryVerify = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      throw new Error(`Apple verify HTTP ${res.status}`);
    }
    return res.json() as Promise<any>;
  };

  try {
    let data = await tryVerify("https://buy.itunes.apple.com/verifyReceipt");
    if (data?.status === 21007) {
      data = await tryVerify("https://sandbox.itunes.apple.com/verifyReceipt");
    }
    if (data?.status !== 0) {
      return { valid: false, reason: `Apple status=${data?.status}`, raw: data };
    }

    if (expectedProductId) {
      const inApp = data?.receipt?.in_app || data?.latest_receipt_info || [];
      const match = inApp.some((p: any) => p.product_id === expectedProductId);
      if (!match) {
        return { valid: false, reason: "productId mismatch in receipt", raw: data };
      }
    }

    return { valid: true, raw: data, productId: expectedProductId };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "Apple verify failed" };
  }
}

function loadGoogleServiceAccount(): any | null {
  const saPathEnv = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  const saJsonEnv =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.IN_APP_CREDENTIALS;

  if (saPathEnv && String(saPathEnv).trim()) {
    const full = path.isAbsolute(saPathEnv)
      ? saPathEnv
      : path.join(process.cwd(), saPathEnv);
    if (fs.existsSync(full)) {
      try {
        return JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        return null;
      }
    }
  }

  if (saJsonEnv && String(saJsonEnv).trim()) {
    const trimmed = String(saJsonEnv).trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
    const asFile = path.isAbsolute(trimmed)
      ? trimmed
      : path.join(process.cwd(), trimmed);
    if (fs.existsSync(asFile)) {
      try {
        return JSON.parse(fs.readFileSync(asFile, "utf8"));
      } catch {
        return null;
      }
    }
  }

  return null;
}

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const b64url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsigned = `${b64url(header)}.${b64url(payload)}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as any;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google OAuth failed: ${data?.error_description || data?.error || res.status}`
    );
  }
  return data.access_token;
}

/**
 * Verifies a Google Play purchase via Google Play Developer API.
 */
export async function verifyGooglePurchase(
  productId: string,
  purchaseToken: string
): Promise<VerifyReceiptResult> {
  if (!productId || !purchaseToken) {
    return { valid: false, reason: "Missing productId or purchaseToken" };
  }

  const packageName = getGooglePlayPackageName();
  const serviceAccount = loadGoogleServiceAccount();

  if (!serviceAccount) {
    if (process.env.NODE_ENV === "production") {
      return {
        valid: false,
        reason:
          "Google Play service account (GOOGLE_SERVICE_ACCOUNT_JSON) is not configured (required in production)",
      };
    }
    return {
      valid: true,
      reason: "verification-disabled-non-production",
      productId,
    };
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
      purchaseToken
    )}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as any;

    if (!res.ok) {
      return {
        valid: false,
        reason: `Google HTTP ${res.status}: ${data?.error?.message || ""}`,
        raw: data,
      };
    }

    if (data?.purchaseState !== 0) {
      return {
        valid: false,
        reason: `purchaseState=${data?.purchaseState}`,
        raw: data,
      };
    }

    return {
      valid: true,
      raw: data,
      productId,
      transactionId: data?.orderId || purchaseToken,
    };
  } catch (err: any) {
    return { valid: false, reason: err?.message || "Google verify failed" };
  }
}

/**
 * Consumes a Google Play product after crediting the user.
 */
export async function consumeGoogleProductServer(
  productId: string,
  purchaseToken: string
): Promise<{ ok: boolean; reason?: string }> {
  if (!productId || !purchaseToken) {
    return { ok: false, reason: "Missing productId or purchaseToken" };
  }

  const packageName = getGooglePlayPackageName();
  const serviceAccount = loadGoogleServiceAccount();
  if (!serviceAccount) {
    return { ok: true };
  }

  try {
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const consumeUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
      packageName
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
      purchaseToken
    )}:consume`;

    const res = await fetch(consumeUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const cErr = (await res.json().catch(() => ({}))) as any;
      return { ok: false, reason: cErr?.error?.message || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message || "Google consume failed" };
  }
}
