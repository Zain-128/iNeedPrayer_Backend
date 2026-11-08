import { Router } from "express";
import {
  verifySmtp,
  getRecentEmailLogs,
  getQueueLength,
  sendEmail,
  isDeliverableEmail,
  getCircuitBreakerState,
  resetCircuitBreaker,
} from "../services/email/mailer.js";
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  MAIL_FROM_EMAIL,
  MAIL_FROM_NAME,
  isSmtpConfigured,
} from "../contants.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ ok: true, message: "test route" });
});

router.get("/ping", (_req, res) => {
  res.json({ ok: true, ping: "pong" });
});

/**
 * Diagnostic endpoint: checks SMTP connectivity, host, user, queue size, circuit breaker state, and recent logs.
 * Safe to call; does not send any emails.
 */
router.get("/smtp-status", async (_req, res) => {
  const smtpCheck = await verifySmtp();
  res.json({
    configured: isSmtpConfigured(),
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    user: SMTP_USER,
    fromEmail: MAIL_FROM_EMAIL,
    fromName: MAIL_FROM_NAME,
    connectionStatus: smtpCheck.ok ? "Connected & Ready" : "Failed / Disabled",
    connectionError: smtpCheck.error || null,
    queueLength: getQueueLength(),
    circuitBreaker: getCircuitBreakerState(),
    recentLogs: getRecentEmailLogs(),
  });
});

/**
 * Reset circuit breaker endpoint: allows manual reset if the breaker was tripped.
 */
router.post("/reset-circuit-breaker", (_req, res) => {
  resetCircuitBreaker();
  res.json({ success: true, message: "Email circuit breaker has been reset.", circuitBreaker: getCircuitBreakerState() });
});

/**
 * Safe test send endpoint: sends a single verification test email to a given recipient.
 */
router.post("/send-test-email", async (req, res) => {
  const { email } = req.body ?? {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ success: false, message: "Please provide a valid recipient email." });
  }

  if (!isDeliverableEmail(email)) {
    return res.status(400).json({
      success: false,
      message: "Address rejected by anti-bounce validation (invalid domain or dummy prefix).",
    });
  }

  try {
    const success = await sendEmail(
      email.trim(),
      {
        subject: "iNeedPrayer SMTP Delivery Test",
        html: `
          <div style="font-family: sans-serif; padding: 20px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0E3B43;">iNeedPrayer SMTP Verification</h2>
            <p>This is a verified test email sent from the <strong>${MAIL_FROM_NAME}</strong> backend on Hostinger.</p>
            <p>Timestamp: <strong>${new Date().toUTCString()}</strong></p>
            <p style="color: #64748b; font-size: 13px;">If you received this message, outbound email delivery is fully operational.</p>
          </div>
        `,
        text: `iNeedPrayer SMTP Verification\n\nThis is a verified test email sent at ${new Date().toUTCString()}. Deliverability is operational.`,
      },
      { bypassDedup: true }
    );

    if (success) {
      return res.json({ success: true, message: `Test email dispatched to ${email}` });
    } else {
      return res.status(502).json({
        success: false,
        message: "Failed to dispatch test email. Check server logs or /api/test/smtp-status for details.",
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});

/**
 * Diagnostic endpoint: returns Google Play Coin Packages configuration and wallet credit mapping.
 */
router.get("/google-play-packages", (_req, res) => {
  const packages = [
    {
      package: "100 Coins",
      googlePlayProductId: "coins100",
      price: "$0.99",
      priceCents: 99,
      baseCoins: 100,
      bonusCoins: 0,
      totalWalletCredit: 100,
      purchaseOptionId: "standard",
      purchaseType: "Buy (Consumable)",
    },
    {
      package: "500 Coins",
      googlePlayProductId: "coins500",
      price: "$4.99",
      priceCents: 499,
      baseCoins: 500,
      bonusCoins: 25,
      totalWalletCredit: 525,
      purchaseOptionId: "standard",
      purchaseType: "Buy (Consumable)",
    },
    {
      package: "1,000 Coins",
      googlePlayProductId: "coins1000",
      price: "$9.99",
      priceCents: 999,
      baseCoins: 1000,
      bonusCoins: 100,
      totalWalletCredit: 1100,
      purchaseOptionId: "standard",
      purchaseType: "Buy (Consumable)",
    },
    {
      package: "2,500 Coins",
      googlePlayProductId: "coins2500",
      price: "$24.99",
      priceCents: 2499,
      baseCoins: 2500,
      bonusCoins: 250,
      totalWalletCredit: 2750,
      purchaseOptionId: "standard",
      purchaseType: "Buy (Consumable)",
    },
    {
      package: "5,000 Coins",
      googlePlayProductId: "coins5000",
      price: "$49.99",
      priceCents: 4999,
      baseCoins: 5000,
      bonusCoins: 750,
      totalWalletCredit: 5750,
      purchaseOptionId: "standard",
      purchaseType: "Buy (Consumable)",
    },
  ];

  res.json({
    ok: true,
    androidPackageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.ineedprayer",
    purchaseOptionId: "standard",
    purchaseType: "Buy (Consumable)",
    packages,
    walletMapping: {
      coins100: "100 Coins (100 Base + 0 Bonus)",
      coins500: "525 Coins (500 Base + 25 Bonus)",
      coins1000: "1,100 Coins (1,000 Base + 100 Bonus)",
      coins2500: "2,750 Coins (2,500 Base + 250 Bonus)",
      coins5000: "5,750 Coins (5,000 Base + 750 Bonus)",
    },
    verifyEndpoint: "POST /api/wallet/coins/verify-iap",
    verifyPayloadExample: {
      platform: "android",
      productId: "coins500",
      purchaseToken: "google_play_purchase_token_from_client",
      transactionId: "GPA.1234-5678-9012-34567",
    },
  });
});

export default router;
