import nodemailer from "nodemailer";

const configured =
  !!process.env.SMTP_HOST &&
  !!process.env.SMTP_PORT &&
  !!process.env.SMTP_USER &&
  !!process.env.SMTP_PASS &&
  !!process.env.EMAIL_FROM;

export function isDepositBalanceReminderEmailConfigured() {
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

type DepositReminderArgs = {
  toEmail: string;
  customerName?: string | null;
  orderReference?: string | null;
  carTitle?: string | null;
  remainingBalanceGhs?: number | null;
  balanceDueAt?: Date | string | null;
  dashboardUrl?: string | null;
  subject?: string;
  html?: string;
};

function money(amount: number | null | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return "the outstanding balance";
  return `GHS ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "the agreed payment window";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "the agreed payment window";
  return d.toLocaleDateString("en-GB");
}

function buildDepositReminderEmail(args: DepositReminderArgs) {
  const name = args.customerName?.trim() || "Customer";
  const reference = args.orderReference?.trim() || "your vehicle reservation";
  const car = args.carTitle?.trim() || "your reserved vehicle";
  const amount = money(args.remainingBalanceGhs);
  const due = dateLabel(args.balanceDueAt);
  const dashboardUrl =
    args.dashboardUrl || `${process.env.NEXT_PUBLIC_APP_URL || "https://www.sparkanddriveautos.com"}/dashboard/orders`;

  const subject = args.subject || `Balance reminder for ${reference}`;

  const html =
    args.html ||
    `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Vehicle reservation balance reminder</h2>
        <p>Hello ${name},</p>
        <p>This is a reminder that the remaining balance for <strong>${car}</strong> is still pending.</p>
        <p><strong>Order reference:</strong> ${reference}</p>
        <p><strong>Outstanding balance:</strong> ${amount}</p>
        <p><strong>Due date/window:</strong> ${due}</p>
        <p>You can review your order here:</p>
        <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
        <p>Thank you,<br/>Spark & Drive Autos</p>
      </div>
    `;

  return { subject, html };
}

export async function sendDepositReminderEmail(args: DepositReminderArgs) {
  if (!configured) return { ok: false, error: "SMTP email is not configured" };

  const { subject, html } = buildDepositReminderEmail(args);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: args.toEmail,
    subject,
    html,
  });

  return { ok: true };
}

export async function sendDepositBalanceReminderEmailSafe(args: DepositReminderArgs) {
  try {
    return await sendDepositReminderEmail(args);
  } catch (error) {
    console.error("[deposit-balance-reminder-email]", error);
    return { ok: false, error: "Could not send reminder email" };
  }
}
