import "server-only";

import nodemailer from "nodemailer";
import type { Role } from "@/lib/types";

type EduPulseEmailInput = {
  to: string | null | undefined;
  subject: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionUrl?: string;
  detailLabel?: string;
  detailValue?: string;
};

type WelcomeEmailInput = {
  to: string | null | undefined;
  displayName: string;
  role: Role;
  appUrl?: string;
};

type ProfileEmailRow = {
  id?: string | null;
  email?: string | null;
  display_name?: string | null;
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
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://edupulsebeta.vercel.app";
  const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;

  return withProtocol.replace(/\/$/, "");
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

function roleLabel(role: Role) {
  return role.replace("_", " ");
}

function absoluteUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return appUrl();
  if (pathOrUrl.startsWith("http")) return pathOrUrl;

  return `${appUrl()}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml({
  eyebrow,
  title,
  body,
  actionLabel = "Open EduPulse",
  actionUrl,
  detailLabel,
  detailValue,
}: EduPulseEmailInput) {
  const targetUrl = absoluteUrl(actionUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f8fc;padding:28px 14px;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;">
      <tr>
        <td style="padding:0 0 14px;text-align:center;">
          <span style="display:inline-block;color:#2563eb;font-size:13px;font-weight:600;letter-spacing:.08em;">EduPulse</span>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;border-radius:24px;overflow:hidden;background:#ffffff;border:1px solid #dbe7f3;box-shadow:0 18px 50px rgba(15,23,42,.10);">
      <tr>
        <td style="height:5px;background:linear-gradient(90deg,#1d4ed8,#38bdf8);font-size:0;line-height:0;">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:34px 34px 18px;">
          <div style="display:inline-block;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;padding:7px 12px;color:#1d4ed8;font-size:12px;font-weight:500;letter-spacing:.10em;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:20px 0 12px;font-size:29px;line-height:1.18;letter-spacing:-.01em;color:#0f172a;font-weight:650;">${escapeHtml(title)}</h1>
          <p style="margin:0;color:#475569;font-size:15px;line-height:1.75;font-weight:400;">${escapeHtml(body)}</p>
        </td>
      </tr>
      ${
        detailLabel && detailValue
          ? `<tr>
        <td style="padding:0 34px 24px;">
          <div style="border-radius:18px;background:#f8fbff;border:1px solid #e2edf8;padding:18px;">
            <p style="margin:0 0 7px;color:#64748b;font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:.10em;">${escapeHtml(detailLabel)}</p>
            <p style="margin:0;color:#0f172a;font-size:18px;font-weight:550;line-height:1.4;">${escapeHtml(detailValue)}</p>
          </div>
        </td>
      </tr>`
          : ""
      }
      <tr>
        <td style="padding:0 34px 36px;">
          <a href="${escapeHtml(targetUrl)}" style="display:block;text-align:center;text-decoration:none;border-radius:14px;background:#1d4ed8;padding:14px 18px;color:#ffffff;font-weight:600;font-size:15px;box-shadow:0 10px 24px rgba(29,78,216,.22);">${escapeHtml(actionLabel)}</a>
          <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;text-align:center;">You received this because your EduPulse account uses this email address.</p>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;">
      <tr>
        <td style="padding:16px 18px 0;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6;">
          EduPulse keeps classroom updates, assignments, feedback, and messages connected.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEduPulseEmail(input: EduPulseEmailInput) {
  if (!isRealDeliverableEmail(input.to)) {
    return { skipped: true, reason: "non-deliverable-email" };
  }

  const config = smtpConfig();
  if (!config) {
    console.warn("EduPulse email skipped: EMAIL_SMTP_PASSWORD is not set.");
    return { skipped: true, reason: "smtp-not-configured" };
  }

  const transporter = nodemailer.createTransport(config);
  await transporter.sendMail({
    from: senderAddress(),
    to: input.to!,
    subject: input.subject,
    html: emailHtml(input),
  });

  return { skipped: false };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const label = roleLabel(input.role);

  return sendEduPulseEmail({
    to: input.to,
    subject: "Your EduPulse account is ready",
    eyebrow: "EduPulse access",
    title: "Welcome to your learning workspace.",
    body: `Hi ${input.displayName}, your ${label} account is ready. EduPulse keeps classes, assignments, notes, messages, and learning focus in one calm place.`,
    detailLabel: "Your role",
    detailValue: label,
    actionUrl: input.appUrl,
  });
}

export async function sendLoginEmail(input: {
  to: string | null | undefined;
  displayName: string;
  role: Role;
}) {
  return sendEduPulseEmail({
    to: input.to,
    subject: "New EduPulse sign-in",
    eyebrow: "Secure sign-in",
    title: "Your account was just used to sign in.",
    body: `Hi ${input.displayName}, EduPulse noticed a sign-in to your ${roleLabel(input.role)} workspace. If this was you, no action is needed.`,
    detailLabel: "Signed in as",
    detailValue: roleLabel(input.role),
  });
}

export async function sendPasswordResetNoticeEmail(input: {
  to: string | null | undefined;
  displayName?: string | null;
}) {
  return sendEduPulseEmail({
    to: input.to,
    subject: "EduPulse password reset requested",
    eyebrow: "Password reset",
    title: "Password reset email sent.",
    body: `Hi ${input.displayName ?? "there"}, a password reset was requested for your EduPulse account. Use the secure reset email to continue.`,
    actionLabel: "Open EduPulse",
  });
}

export async function sendProfileNotificationEmails({
  supabase,
  profileIds,
  subject,
  eyebrow,
  title,
  body,
  actionUrl,
  actionLabel,
  detailLabel,
  detailValue,
}: {
  // Supabase's fluent query builder has very deep generic types in this app.
  // Keep this helper structurally loose so notification routes stay readable.
  supabase: {
    from: (table: string) => unknown;
  };
  profileIds: Array<string | null | undefined>;
} & Omit<EduPulseEmailInput, "to">) {
  const ids = Array.from(new Set(profileIds.filter(Boolean))) as string[];
  if (!ids.length) return;

  const query = supabase.from("profiles") as {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => PromiseLike<{ data: ProfileEmailRow[] | null; error: unknown }>;
    };
  };
  const { data, error } = await query
    .select("id,email,display_name")
    .in("id", ids);

  if (error || !data?.length) {
    if (error) console.warn("Email profile lookup skipped", error);
    return;
  }

  await Promise.allSettled(
    data.map((profile) =>
      sendEduPulseEmail({
        to: profile.email,
        subject,
        eyebrow,
        title,
        body: body.replaceAll("{name}", profile.display_name ?? "there"),
        actionUrl,
        actionLabel,
        detailLabel,
        detailValue,
      }),
    ),
  );
}
