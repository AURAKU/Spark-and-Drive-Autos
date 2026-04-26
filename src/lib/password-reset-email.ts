import { getPublicAppUrl } from "@/lib/app-url";

const RESEND_API_URL = "https://api.resend.com/emails";

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESET_PASSWORD_FROM_EMAIL?.trim());
}

export async function sendPasswordResetEmail(params: { toEmail: string; token: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESET_PASSWORD_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) {
    throw new Error("PASSWORD_RESET_EMAIL_NOT_CONFIGURED");
  }

  const resetUrl = `${getPublicAppUrl()}/reset-password?token=${encodeURIComponent(params.token)}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827;">
      <h2 style="margin:0 0 10px;">Spark &amp; Drive Gear password reset</h2>
      <p style="margin:0 0 12px;">A password reset was requested for your account.</p>
      <p style="margin:0 0 12px;">
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#f97316;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px;">This link expires in 30 minutes.</p>
      <p style="margin:0;">If you did not request this change, you can safely ignore this email.</p>
    </div>
  `.trim();

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [params.toEmail],
      subject: "Reset your Spark & Drive Gear password",
      html,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PASSWORD_RESET_EMAIL_SEND_FAILED:${response.status}:${errText.slice(0, 300)}`);
  }
}
