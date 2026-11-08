import nodemailer, { type Transporter } from "nodemailer";
import crypto from "crypto";
import {
  isSmtpConfigured,
  MAIL_FROM_EMAIL,
  MAIL_FROM_NAME,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SUPPORT_EMAIL,
} from "../../contants.js";
import type { EmailContent } from "./templates.js";

// ============================================================
// AUDIT & LOGGING TYPES
// ============================================================

export interface EmailLogEntry {
  id: string;
  timestamp: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "suppressed_duplicate" | "rejected_invalid" | "queued" | "circuit_breaker_active";
  messageId?: string;
  response?: string;
  error?: string;
  attempts: number;
}

const recentLogs: EmailLogEntry[] = [];
const MAX_LOGS = 100;

function recordLog(entry: Omit<EmailLogEntry, "id" | "timestamp">) {
  const full: EmailLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  recentLogs.unshift(full);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.pop();
  }
}

export function getRecentEmailLogs(): EmailLogEntry[] {
  return [...recentLogs];
}

// ============================================================
// ANTI-BOUNCE & EMAIL SANITIZATION
// ============================================================

const DUMMY_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.org",
  "invalid.com",
  "dummy.com",
  "sample.com",
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "throwaway.com",
]);

/**
 * Checks if the email is syntactically valid and not a known dummy/test address.
 * Hostinger suspends accounts when emails bounce (550 Mailbox not found).
 */
export function isDeliverableEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();

  // Basic RFC 5322 regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];

  if (DUMMY_DOMAINS.has(domain)) {
    return false;
  }

  // Reject dummy prefixes like test@, asdf@, fake@ on generic domains
  if (/^(test|dummy|fake|sample|asdf|qwerty)\d*@/i.test(trimmed)) {
    return false;
  }

  return true;
}

// ============================================================
// DEDUPLICATION CACHE
// ============================================================

/** Cache key -> expiration timestamp */
const deduplicationCache = new Map<string, number>();
const DEDUP_WINDOW_MS = 60 * 1000; // 60 seconds

// Periodic cleanup of deduplication map
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of deduplicationCache.entries()) {
    if (now >= expiresAt) {
      deduplicationCache.delete(key);
    }
  }
}, 2 * 60 * 1000).unref();

function getDedupKey(to: string, subject: string): string {
  return crypto
    .createHash("sha256")
    .update(`${to.trim().toLowerCase()}:${subject.trim().toLowerCase()}`)
    .digest("hex");
}

function isDuplicate(to: string, subject: string): boolean {
  const key = getDedupKey(to, subject);
  const now = Date.now();
  const expiresAt = deduplicationCache.get(key);
  if (expiresAt && now < expiresAt) {
    return true;
  }
  deduplicationCache.set(key, now + DEDUP_WINDOW_MS);
  return false;
}

// ============================================================
// CIRCUIT BREAKER / ABUSE SPIKE SHIELD
// ============================================================

let circuitBreakerTrippedUntil = 0;
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_BREAKER_DURATION_MS = 10 * 60 * 1000; // 10 minutes pause

export function isCircuitBreakerOpen(): boolean {
  return Date.now() < circuitBreakerTrippedUntil;
}

export function getCircuitBreakerState(): {
  isOpen: boolean;
  remainingSeconds: number;
  consecutiveFailures: number;
} {
  const isOpen = Date.now() < circuitBreakerTrippedUntil;
  const remainingSeconds = isOpen
    ? Math.max(0, Math.ceil((circuitBreakerTrippedUntil - Date.now()) / 1000))
    : 0;
  return {
    isOpen,
    remainingSeconds,
    consecutiveFailures,
  };
}

export function resetCircuitBreaker(): void {
  circuitBreakerTrippedUntil = 0;
  consecutiveFailures = 0;
  console.log("[email-circuit-breaker] Circuit breaker manually reset to CLOSED");
}

// ============================================================
// HOSTINGER-OPTIMIZED TRANSPORTER
// ============================================================

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      pool: true,
      maxConnections: 1, // Single connection strictly avoids Hostinger concurrency limits
      maxMessages: 50, // Refresh socket every 50 messages
      rateLimit: 10, // Max 10 messages per minute window to prevent burst flags
      rateDelta: 60000,
      connectionTimeout: 10000, // 10s connection timeout
      greetingTimeout: 10000,
      socketTimeout: 15000, // 15s socket timeout
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
    });

    transporter.on("error", (err) => {
      console.error("[email] Transporter pool error:", err.message);
    });
  }
  return transporter;
}

// ============================================================
// DIRECT SEND EMAIL FUNCTION
// ============================================================

export interface SendEmailOptions {
  bypassDedup?: boolean;
}

/**
 * Sends one email via SMTP with deduplication, anti-bounce check, and detailed audit logging.
 * Returns true if accepted by SMTP server, false otherwise.
 */
export async function sendEmail(
  to: string | null | undefined,
  content: EmailContent,
  opts?: SendEmailOptions
): Promise<boolean> {
  const recipient = to?.trim().toLowerCase();

  if (!recipient) {
    console.warn(`[email] Skipped send: empty recipient for "${content.subject}"`);
    return false;
  }

  // 1. Anti-bounce check
  if (!isDeliverableEmail(recipient)) {
    console.warn(`[email] Anti-bounce filter: rejected invalid/dummy address "${recipient}"`);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "rejected_invalid",
      error: "Address failed deliverability / anti-bounce check",
      attempts: 0,
    });
    return false;
  }

  // 2. Deduplication check (prevents double-tap spam from mobile apps)
  if (!opts?.bypassDedup && isDuplicate(recipient, content.subject)) {
    console.log(`[email] Suppressed duplicate email to ${recipient} ("${content.subject}")`);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "suppressed_duplicate",
      attempts: 0,
    });
    return true; // Return true so caller continues smoothly without re-triggering
  }

  // 3. SMTP configuration check
  if (!isSmtpConfigured()) {
    console.warn(`[email] SMTP not configured; skipped "${content.subject}" to ${recipient}`);
    return false;
  }

  // 4. Circuit Breaker check: protects Hostinger mailbox from automated suspension if consecutive errors occur
  if (isCircuitBreakerOpen()) {
    const remainingSec = Math.ceil((circuitBreakerTrippedUntil - Date.now()) / 1000);
    console.warn(`[email] Circuit breaker is OPEN. Pausing outbound SMTP for ${remainingSec}s to protect Hostinger mailbox.`);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "circuit_breaker_active",
      error: `Circuit breaker tripped (${remainingSec}s cooldown remaining)`,
      attempts: 0,
    });
    return false;
  }

  try {
    const fromAddress = `"${MAIL_FROM_NAME}" <${MAIL_FROM_EMAIL}>`;
    const info = await getTransporter().sendMail({
      from: fromAddress,
      replyTo: SUPPORT_EMAIL || undefined,
      to: recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: {
        "X-Mailer": "iNeedPrayer-Mailer/2.0",
        "Precedence": "bulk",
        "Auto-Submitted": "auto-generated",
      },
    });

    if (info.rejected?.length) {
      const rejStr = String(info.response || "Recipient rejected by server");
      console.error(`[email] Rejected "${content.subject}" to ${recipient}: ${rejStr}`);
      recordLog({
        to: recipient,
        subject: content.subject,
        status: "failed",
        error: rejStr,
        response: info.response,
        attempts: 1,
      });

      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        circuitBreakerTrippedUntil = Date.now() + CIRCUIT_BREAKER_DURATION_MS;
        console.error(
          `[email-circuit-breaker] ${consecutiveFailures} consecutive SMTP rejections encountered! Tripping circuit breaker for ${CIRCUIT_BREAKER_DURATION_MS / 60000}m.`
        );
      }
      return false;
    }

    // Success: reset consecutive failures counter
    consecutiveFailures = 0;
    console.log(`[email] Sent "${content.subject}" to ${recipient} (${info.messageId}) ${info.response || ""}`);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "sent",
      messageId: info.messageId,
      response: info.response,
      attempts: 1,
    });
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error(`[email] Failed "${content.subject}" to ${recipient}:`, errorMsg);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "failed",
      error: errorMsg,
      attempts: 1,
    });

    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      circuitBreakerTrippedUntil = Date.now() + CIRCUIT_BREAKER_DURATION_MS;
      console.error(
        `[email-circuit-breaker] ${consecutiveFailures} consecutive SMTP errors encountered! Tripping circuit breaker for ${CIRCUIT_BREAKER_DURATION_MS / 60000}m to prevent mailbox suspension.`
      );
    }
    return false;
  }
}

// ============================================================
// SEQUENTIAL RATE-CONTROLLED QUEUE
// ============================================================

interface QueuedItem {
  to: string;
  content: EmailContent;
  attempts: number;
  maxAttempts: number;
  queuedAt: number;
}

const emailQueue: QueuedItem[] = [];
let isQueueProcessing = false;
const MIN_QUEUE_INTERVAL_MS = 1500; // 1.5 seconds between queued emails to respect Hostinger rate limits

async function processQueueLoop(): Promise<void> {
  if (isQueueProcessing) return;
  isQueueProcessing = true;

  while (emailQueue.length > 0) {
    const item = emailQueue.shift();
    if (!item) break;

    item.attempts += 1;
    try {
      const ok = await sendEmail(item.to, item.content, { bypassDedup: true });
      if (!ok && item.attempts < item.maxAttempts) {
        // Only retry if it's not an anti-bounce or invalid error
        if (isDeliverableEmail(item.to)) {
          console.log(`[email-queue] Retrying email to ${item.to} (Attempt ${item.attempts + 1}/${item.maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          emailQueue.push(item);
        }
      }
    } catch (e: any) {
      console.error(`[email-queue] Error dispatching to ${item.to}:`, e?.message);
    }

    // Delay before next dispatch to avoid burst spikes
    await new Promise((resolve) => setTimeout(resolve, MIN_QUEUE_INTERVAL_MS));
  }

  isQueueProcessing = false;
}

/**
 * Enqueues an email for asynchronous delivery with controlled rates,
 * anti-bounce validation, and automatic retries.
 */
export function queueEmail(
  to: string | null | undefined,
  content: EmailContent,
  maxAttempts = 2
): void {
  const recipient = to?.trim().toLowerCase();
  if (!recipient || !isDeliverableEmail(recipient)) {
    console.warn(`[email-queue] Skipped enqueueing invalid address "${to}"`);
    return;
  }

  // Deduplication check before pushing to queue
  if (isDuplicate(recipient, content.subject)) {
    console.log(`[email-queue] Suppressed duplicate enqueue for ${recipient} ("${content.subject}")`);
    recordLog({
      to: recipient,
      subject: content.subject,
      status: "suppressed_duplicate",
      attempts: 0,
    });
    return;
  }

  emailQueue.push({
    to: recipient,
    content,
    attempts: 0,
    maxAttempts: Math.min(3, Math.max(1, maxAttempts)),
    queuedAt: Date.now(),
  });

  void processQueueLoop();
}

/** Returns the current count of pending queued emails. */
export function getQueueLength(): number {
  return emailQueue.length;
}

// ============================================================
// SMTP CONNECTIVITY VERIFICATION
// ============================================================

export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured()) return { ok: false, error: "SMTP not configured" };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
