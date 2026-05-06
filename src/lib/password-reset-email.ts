import nodemailer from "nodemailer";

const configured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_PORT &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS &&
  !!process.env.EMAIL_FROM;

export function isPasswordResetEmailConfigured() {
  return configured;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(args: {
  toEmail: string;
  token: string;
  resetUrl?: string;
}) {
  if (!configured) return { ok: false, error: "SMTP email is not configured" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.sparkanddriveautos.com";
  const resetUrl = args.resetUrl || `${appUrl}/reset-password?token=${encodeURIComponent(args.token)}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: args.toEmail,
    subject: "Reset your Spark & Drive Autos password",
    html: `
      <h2>Password reset</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });

  return { ok: true };
}
