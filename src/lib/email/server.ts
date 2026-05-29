import "server-only";

import nodemailer from "nodemailer";

type WelcomeEmailInput = {
  to: string | null | undefined;
  displayName: string;
  role: "student" | "teacher" | "admin" | "super_admin";
  appUrl?: string;
};

const blockedEmailHints = [
  "dummy",
  "fake",
  "test",
  "sample",
  "demo",
  "example",
];

const blockedDomains = new Set([
  "edupulse.com",
  "edupulse.local",
  "luminalearn.demo",
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "localhost",
]);

export function isRealDeliverableEmail(email: string | null | undefined) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const [, domain = ""] = normalized.split("@");

  if (!normalized.includes("@") || blockedDomains.has(domain)) return false;
  return !blockedEmailHints.some((hint) => normalized.includes(hint));
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://edupulsebeta.vercel.app"
  ).replace(/\/$/, "");
}

function senderAddress() {
  return process.env.EMAIL_FROM ?? "EduPulse <ahmadxoffcl@gmail.com>";
}

function smtpConfig() {
  const user = process.env.EMAIL_SMTP_USER ?? "ahmadxoffcl@gmail.com";
  const pass =
    process.env.EMAIL_SMTP_PASSWORD ?? process.env.GMAIL_APP_PASSWORD;

  if (!pass) return null;

  return {
    host: process.env.EMAIL_SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.EMAIL_SMTP_PORT ?? 465),
    secure: process.env.EMAIL_SMTP_SECURE !== "false",
    auth: {
      user,
      pass,
    },
  };
}

function roleLabel(role: WelcomeEmailInput["role"]) {
  return role.replace("_", " ");
}

function welcomeEmailHtml({
  displayName,
  role,
  appUrl: inputAppUrl,
}: WelcomeEmailInput) {
  const targetUrl = inputAppUrl ?? appUrl();
  const label = roleLabel(role);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#05070c;padding:32px;font-family:Inter,Arial,sans-serif;color:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;border-radius:32px;overflow:hidden;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(8,13,24,.98));border:1px solid rgba(148,163,184,.22);box-shadow:0 30px 90px rgba(8,47,73,.35);">
      <tr>
        <td style="padding:34px 34px 18px;">
          <div style="display:inline-block;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(103,232,249,.28);padding:8px 13px;color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">EduPulse access</div>
          <h1 style="margin:22px 0 10px;font-size:34px;line-height:1.08;letter-spacing:-.02em;color:#ffffff;">Welcome to your learning workspace.</h1>
          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.7;">Hi ${escapeHtml(displayName)}, your ${escapeHtml(label)} account is ready. EduPulse keeps classes, assignments, notes, messages, and learning focus in one calm place.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 34px 26px;">
          <div style="border-radius:26px;background:linear-gradient(135deg,rgba(14,165,233,.16),rgba(99,102,241,.16),rgba(245,158,11,.14));border:1px solid rgba(255,255,255,.14);padding:22px;">
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;">Your role</p>
            <p style="margin:0;color:#fff;font-size:24px;font-weight:800;text-transform:capitalize;">${escapeHtml(label)}</p>
            <p style="margin:12px 0 0;color:#dbeafe;font-size:14px;line-height:1.6;">Use your email and password to continue. If this account was created by an admin, your dashboard will open directly.</p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 34px 36px;">
          <a href="${escapeHtml(targetUrl)}" style="display:block;text-align:center;text-decoration:none;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#4f46e5 58%,#f59e0b);padding:15px 18px;color:white;font-weight:800;font-size:15px;">Open EduPulse</a>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">This message was sent only for real inbox addresses. Dummy EduPulse demo emails are skipped automatically.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  if (!isRealDeliverableEmail(input.to)) {
    return { skipped: true, reason: "non-deliverable-email" };
  }

  const config = smtpConfig();
  if (!config) {
    console.warn("Welcome email skipped: EMAIL_SMTP_PASSWORD is not set.");
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from: senderAddress(),
    to: input.to!,
    subject: "Your EduPulse account is ready",
    html: welcomeEmailHtml(input),
  });

  return { skipped: false };
}
