import nodemailer, { type Transporter } from "nodemailer";
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

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });
  }
  return transporter;
}

/**
 * Sends one email. Returns false (and logs) instead of throwing, so a mail
 * failure never breaks the API flow that triggered it.
 */
export async function sendEmail(
  to: string | null | undefined,
  content: EmailContent
): Promise<boolean> {
  const recipient = to?.trim();
  if (!recipient) return false;
  if (!isSmtpConfigured()) {
    console.warn(`[email] SMTP not configured; skipped "${content.subject}" to ${recipient}`);
    return false;
  }
  try {
    const info = await getTransporter().sendMail({
      from: { name: MAIL_FROM_NAME, address: MAIL_FROM_EMAIL },
      replyTo: SUPPORT_EMAIL || undefined,
      to: recipient,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
    if (info.rejected?.length) {
      console.error(`[email] Rejected "${content.subject}" to ${recipient}: ${info.response}`);
      return false;
    }
    console.log(`[email] Sent "${content.subject}" to ${recipient} (${info.messageId}) ${info.response}`);
    return true;
  } catch (err) {
    console.error(`[email] Failed "${content.subject}" to ${recipient}:`, (err as Error).message);
    return false;
  }
}

/** Fire-and-forget variant for side-effect emails (welcome, receipts, alerts). */
export function queueEmail(to: string | null | undefined, content: EmailContent): void {
  void sendEmail(to, content);
}

/** Checks SMTP credentials/connectivity. Used at startup and by the admin test endpoint. */
export async function verifySmtp(): Promise<{ ok: boolean; error?: string }> {
  if (!isSmtpConfigured()) return { ok: false, error: "SMTP not configured" };
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
