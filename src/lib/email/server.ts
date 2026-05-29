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
  <body style="margin:0;background:#05070c;padding:32px;font-family:Inter,Arial,sans-serif;color:#f8fafc;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:0 auto;border-radius:32px;overflow:hidden;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(8,13,24,.98));border:1px solid rgba(148,163,184,.22);box-shadow:0 30px 90px rgba(8,47,73,.35);">
      <tr>
        <td style="padding:34px 34px 18px;">
          <div style="display:inline-block;border-radius:999px;background:rgba(34,211,238,.12);border:1px solid rgba(103,232,249,.28);padding:8px 13px;color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:22px 0 10px;font-size:34px;line-height:1.08;letter-spacing:-.02em;color:#ffffff;">${escapeHtml(title)}</h1>
          <p style="margin:0;color:#cbd5e1;font-size:15px;line-height:1.7;">${escapeHtml(body)}</p>
        </td>
      </tr>
      ${
        detailLabel && detailValue
          ? `<tr>
        <td style="padding:0 34px 26px;">
          <div style="border-radius:26px;background:linear-gradient(135deg,rgba(14,165,233,.16),rgba(99,102,241,.16),rgba(245,158,11,.14));border:1px solid rgba(255,255,255,.14);padding:22px;">
            <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;">${escapeHtml(detailLabel)}</p>
            <p style="margin:0;color:#fff;font-size:22px;font-weight:800;">${escapeHtml(detailValue)}</p>
          </div>
        </td>
      </tr>`
          : ""
      }
      <tr>
        <td style="padding:0 34px 36px;">
          <a href="${escapeHtml(targetUrl)}" style="display:block;text-align:center;text-decoration:none;border-radius:999px;background:linear-gradient(135deg,#06b6d4,#4f46e5 58%,#f59e0b);padding:15px 18px;color:white;font-weight:800;font-size:15px;">${escapeHtml(actionLabel)}</a>
          <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">EduPulse sends inbox notifications only to real deliverable email addresses.</p>
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
    body: `Hi ${input.displayName ?? "there"}, a password reset was requested for your EduPulse account. Use the secure reset email from Firebase to continue.`,
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
