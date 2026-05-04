import { getPublicAppUrl } from "@/lib/app-url";

const RESEND_API_URL = "https://api.resend.com/emails";

export function isDepositBalanceReminderEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
      (process.env.DEPOSIT_BALANCE_FROM_EMAIL?.trim() || process.env.RESET_PASSWORD_FROM_EMAIL?.trim()),
  );
}

export async function sendDepositBalanceReminderEmailSafe(params: {
  toEmail: string;
  customerName: string | null;
  orderReference: string;
  carTitle: string | null;
  remainingBalanceGhs: number;
  balanceDueAt: Date | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.DEPOSIT_BALANCE_FROM_EMAIL?.trim() || process.env.RESET_PASSWORD_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    return { sent: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  const base = getPublicAppUrl();
  const dueLine = params.balanceDueAt
    ? `Balance was due on ${params.balanceDueAt.toISOString().slice(0, 10)}.`
    : "Please complete your remaining balance as agreed.";
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827;">
      <h2 style="margin:0 0 10px;">Vehicle balance reminder</h2>
      <p style="margin:0 0 12px;">Hello ${params.customerName?.trim() || "there"},</p>
      <p style="margin:0 0 12px;">This is a reminder about order <strong>${params.orderReference}</strong>
      ${params.carTitle ? `for <strong>${params.carTitle}</strong>` : ""}.</p>
      <p style="margin:0 0 12px;">Outstanding balance (GHS): <strong>${params.remainingBalanceGhs.toFixed(2)}</strong></p>
      <p style="margin:0 0 12px;">${dueLine}</p>
      <p style="margin:0 0 12px;">
        <a href="${base}/dashboard/orders" style="display:inline-block;padding:10px 16px;background:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          View your orders
        </a>
      </p>
      <p style="margin:0;">If you already paid offline, reply with your receipt reference so we can match it.</p>
    </div>
  `.trim();

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [params.toEmail],
        subject: `Balance reminder · ${params.orderReference}`,
        html,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("[deposit-balance-reminder-email]", response.status, errText.slice(0, 400));
      return { sent: false, reason: `HTTP_${response.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[deposit-balance-reminder-email]", e);
    return { sent: false, reason: "FETCH_ERROR" };
  }
}
