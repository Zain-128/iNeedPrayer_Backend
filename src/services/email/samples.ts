import * as t from "./templates.js";
import type { EmailContent } from "./templates.js";

/** Sample content for every template — used by the admin test endpoint and previews. */
export const EMAIL_SAMPLES: Record<string, () => EmailContent> = {
  welcome: () => t.welcomeEmail("Sarah Johnson"),
  passwordReset: () => t.passwordResetCodeEmail({ name: "Sarah Johnson", code: "4821", minutes: 15 }),
  adminPasswordReset: () =>
    t.passwordResetCodeEmail({ name: "Admin", code: "9034", minutes: 15, isAdmin: true }),
  passwordChanged: () => t.passwordChangedEmail("Sarah Johnson"),
  accountBlocked: () => t.accountBlockedEmail("Sarah Johnson", "Spam or misleading content"),
  accountUnblocked: () => t.accountUnblockedEmail("Sarah Johnson"),
  accountDeleted: () => t.accountDeletedEmail("Sarah Johnson"),
  churchVerificationCode: () =>
    t.churchVerificationCodeEmail({ churchName: "Grace Community Church", code: "58210", minutes: 15 }),
  churchVerified: () => t.churchVerifiedEmail("Grace Community Church"),
  subscriptionActivated: () =>
    t.subscriptionActivatedEmail({
      name: "Sarah Johnson",
      planName: "Premium",
      amountCents: 999,
      billing: "Monthly",
      renewsOn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      transactionId: "pi_3PzXample123",
    }),
  subscriptionCancelled: () => t.subscriptionCancelledEmail({ name: "Sarah Johnson", planName: "Premium" }),
  coinsPurchased: () =>
    t.coinsPurchasedEmail({
      name: "Sarah Johnson",
      coins: 500,
      amountCents: 499,
      label: "500 Coins",
      transactionId: "pi_3PzXample456",
    }),
  withdrawalRequested: () =>
    t.withdrawalRequestedEmail({ name: "Pastor James", coins: 2000, amountCents: 2000, method: "Bank" }),
  withdrawalPaid: () =>
    t.withdrawalPaidEmail({ name: "Pastor James", amountCents: 2000, method: "Bank", transactionId: "WD-10293" }),
  withdrawalRejected: () =>
    t.withdrawalRejectedEmail({ name: "Pastor James", amountCents: 2000, reason: "Bank account details are incomplete" }),
  campaign: () =>
    t.campaignEmail({
      name: "Sarah Johnson",
      subject: "Join our 7-day prayer challenge",
      message:
        "This week we're praying together for our families.\n\nOpen the app each morning for a new prayer prompt, and share your story with the community.\nWe'd love to pray with you!",
    }),
};
