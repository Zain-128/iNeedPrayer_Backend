import { EMAIL_LOGO_URL, MAIL_FROM_NAME, SUPPORT_EMAIL } from "../../contants.js";

export type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

const BRAND = MAIL_FROM_NAME || "iNeedPrayer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function greeting(name: string | null | undefined): string {
  const n = name?.trim();
  return n ? `Hi ${n},` : "Hi,";
}

function money(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

type Row = [label: string, value: string | null | undefined];

/**
 * Builds the shared layout. `paragraphs` are plain text (escaped here);
 * `code` renders a large one-time code; `rows` renders a receipt table.
 */
function layout(opts: {
  subject: string;
  name?: string | null;
  paragraphs: string[];
  code?: string;
  rows?: Row[];
  footerNote?: string;
}): EmailContent {
  const { subject, name, paragraphs, code, rows, footerNote } = opts;
  const rowsClean = (rows ?? []).filter((r): r is [string, string] => Boolean(r[1]));

  const header = EMAIL_LOGO_URL
    ? `<img src="${escapeHtml(EMAIL_LOGO_URL)}" alt="${escapeHtml(BRAND)}" height="40" style="display:block;height:40px;border:0;">`
    : `<span style="font-size:22px;font-weight:700;color:#4b3f8f;">${escapeHtml(BRAND)}</span>`;

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const codeHtml = code
    ? `<div style="margin:8px 0 24px;padding:16px;background:#f3f1fb;border-radius:8px;text-align:center;font-size:32px;font-weight:700;letter-spacing:8px;color:#4b3f8f;font-family:monospace;">${escapeHtml(code)}</div>`
    : "";

  const rowsHtml = rowsClean.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;font-size:14px;">${rowsClean
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#777;">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;text-align:right;font-weight:600;">${escapeHtml(value)}</td></tr>`
        )
        .join("")}</table>`
    : "";

  const support = SUPPORT_EMAIL
    ? `Questions? Contact us at <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#4b3f8f;">${escapeHtml(SUPPORT_EMAIL)}</a>.`
    : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px 28px;">
<tr><td style="padding-bottom:24px;">${header}</td></tr>
<tr><td>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">${escapeHtml(greeting(name))}</p>
${paragraphsHtml}${codeHtml}${rowsHtml}
${footerNote ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#777;">${escapeHtml(footerNote)}</p>` : ""}
<p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#333;">God bless,<br>The ${escapeHtml(BRAND)} Team</p>
</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#999;text-align:center;">${support}</p>
</td></tr>
</table>
</body></html>`;

  const text = [
    greeting(name),
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(code ? [`Your code: ${code}`, ""] : []),
    ...rowsClean.map(([label, value]) => `${label}: ${value}`),
    ...(rowsClean.length ? [""] : []),
    ...(footerNote ? [footerNote, ""] : []),
    "God bless,",
    `The ${BRAND} Team`,
    ...(SUPPORT_EMAIL ? ["", `Questions? Contact us at ${SUPPORT_EMAIL}.`] : []),
  ].join("\n");

  return { subject, html, text };
}

/* ─── Account ─── */

export function welcomeEmail(name: string): EmailContent {
  return layout({
    subject: `Welcome to ${BRAND}`,
    name,
    paragraphs: [
      `Welcome to ${BRAND}! We're so glad you're here.`,
      "Share your prayer requests, pray for others, and connect with churches and groups in our community.",
    ],
  });
}

export function passwordResetCodeEmail(opts: {
  name?: string | null;
  code: string;
  minutes: number;
  isAdmin?: boolean;
}): EmailContent {
  return layout({
    subject: `Your ${BRAND} password reset code`,
    name: opts.name,
    paragraphs: [
      opts.isAdmin
        ? "We received a request to reset the password for your admin dashboard account. Use the code below to continue:"
        : "We received a request to reset your password. Use the code below in the app to set a new password:",
    ],
    code: opts.code,
    footerNote: `This code expires in ${opts.minutes} minutes. If you didn't request a password reset, you can safely ignore this email.`,
  });
}

export function passwordChangedEmail(name: string): EmailContent {
  return layout({
    subject: `Your ${BRAND} password was changed`,
    name,
    paragraphs: [
      "Your password was just changed.",
      "If you made this change, no action is needed. If you didn't, please reset your password right away and contact our support team.",
    ],
  });
}

export function accountBlockedEmail(name: string, reason?: string | null): EmailContent {
  return layout({
    subject: `Your ${BRAND} account has been suspended`,
    name,
    paragraphs: [
      "Your account has been suspended for violating our community guidelines.",
      ...(reason?.trim() ? [`Reason: ${reason.trim()}`] : []),
      "If you believe this was a mistake, please reply to this email.",
    ],
  });
}

export function accountUnblockedEmail(name: string): EmailContent {
  return layout({
    subject: `Your ${BRAND} account has been restored`,
    name,
    paragraphs: ["Good news! Your account has been restored and you can sign in again."],
  });
}

export function accountDeletedEmail(name: string): EmailContent {
  return layout({
    subject: `Your ${BRAND} account has been deleted`,
    name,
    paragraphs: [
      "Your account has been deleted as requested. We're sorry to see you go.",
      "If you didn't request this, please contact our support team immediately.",
    ],
  });
}

/* ─── Churches ─── */

export function churchVerificationCodeEmail(opts: {
  churchName: string;
  code: string;
  minutes: number;
}): EmailContent {
  return layout({
    subject: `Verify ${opts.churchName} on ${BRAND}`,
    paragraphs: [
      `Use the code below in the app to verify ${opts.churchName}:`,
    ],
    code: opts.code,
    footerNote: `This code expires in ${opts.minutes} minutes. If you didn't register this church, you can ignore this email.`,
  });
}

export function churchVerifiedEmail(churchName: string): EmailContent {
  return layout({
    subject: `${churchName} is now verified`,
    paragraphs: [
      `${churchName} has been verified on ${BRAND}. Your church page is now live for the community.`,
    ],
  });
}

/* ─── Payments ─── */

export function subscriptionActivatedEmail(opts: {
  name?: string | null;
  planName: string;
  amountCents: number;
  billing: string;
  renewsOn?: Date | null;
  transactionId?: string | null;
}): EmailContent {
  return layout({
    subject: `Your ${opts.planName} subscription is active`,
    name: opts.name,
    paragraphs: [`Thank you! Your ${opts.planName} subscription is now active.`],
    rows: [
      ["Plan", opts.planName],
      ["Billing", opts.billing],
      ["Amount", money(opts.amountCents)],
      ["Renews on", opts.renewsOn ? formatDate(opts.renewsOn) : null],
      ["Transaction ID", opts.transactionId],
    ],
  });
}

export function subscriptionCancelledEmail(opts: {
  name?: string | null;
  planName: string;
}): EmailContent {
  return layout({
    subject: `Your ${opts.planName} subscription was cancelled`,
    name: opts.name,
    paragraphs: [
      `Your ${opts.planName} subscription has been cancelled and will not renew.`,
      "You can subscribe again at any time from the app.",
    ],
  });
}

export function coinsPurchasedEmail(opts: {
  name?: string | null;
  coins: number;
  amountCents: number;
  label?: string | null;
  transactionId?: string | null;
}): EmailContent {
  return layout({
    subject: `Receipt: ${opts.coins} coins added`,
    name: opts.name,
    paragraphs: [`Thank you for your purchase! ${opts.coins} coins have been added to your wallet.`],
    rows: [
      ["Package", opts.label || `${opts.coins} coins`],
      ["Amount", money(opts.amountCents)],
      ["Transaction ID", opts.transactionId],
    ],
  });
}

export function withdrawalRequestedEmail(opts: {
  name?: string | null;
  coins: number;
  amountCents: number;
  method?: string | null;
}): EmailContent {
  return layout({
    subject: "We received your withdrawal request",
    name: opts.name,
    paragraphs: [
      "We received your withdrawal request. Our team will review it and you'll get another email once it's processed.",
    ],
    rows: [
      ["Coins", String(opts.coins)],
      ["Amount", money(opts.amountCents)],
      ["Method", opts.method],
    ],
  });
}

export function withdrawalPaidEmail(opts: {
  name?: string | null;
  amountCents: number;
  method?: string | null;
  transactionId?: string | null;
}): EmailContent {
  return layout({
    subject: "Your withdrawal has been paid",
    name: opts.name,
    paragraphs: ["Your withdrawal has been processed and paid."],
    rows: [
      ["Amount", money(opts.amountCents)],
      ["Method", opts.method],
      ["Reference", opts.transactionId],
    ],
  });
}

export function withdrawalRejectedEmail(opts: {
  name?: string | null;
  amountCents: number;
  reason?: string | null;
}): EmailContent {
  return layout({
    subject: "Your withdrawal request was not approved",
    name: opts.name,
    paragraphs: [
      `Your withdrawal request for ${money(opts.amountCents)} was not approved. The coins have been returned to your wallet.`,
      ...(opts.reason?.trim() ? [`Reason: ${opts.reason.trim()}`] : []),
    ],
  });
}

/* ─── Campaigns ─── */

export function campaignEmail(opts: {
  name?: string | null;
  subject: string;
  message: string;
}): EmailContent {
  return layout({
    subject: opts.subject,
    name: opts.name,
    paragraphs: opts.message.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
  });
}
