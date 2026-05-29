import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionCookieName,
  sessionCookieOptions,
  signAppSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const adminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceSessionId: z.string().min(1),
});

const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function secureEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

function attemptKey(request: Request, email: string) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "local";
  return `${forwardedFor.split(",")[0]}:${email.toLowerCase()}`;
}

function registerFailure(key: string) {
  const now = Date.now();
  const current = failedAttempts.get(key);
  const windowMs = 10 * 60 * 1000;

  if (!current || current.resetAt < now) {
    failedAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  failedAttempts.set(key, {
    count: current.count + 1,
    resetAt: current.resetAt,
  });
}

function isBlocked(key: string) {
  const current = failedAttempts.get(key);
  if (!current) return false;

  if (current.resetAt < Date.now()) {
    failedAttempts.delete(key);
    return false;
  }

  return current.count >= 5;
}

export async function POST(request: Request) {
  let formRequest = false;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    formRequest =
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data");
    const formData = formRequest ? await request.formData() : null;
    const body = formRequest
      ? adminSchema.parse({
          email: String(formData?.get("email") ?? ""),
          password: String(formData?.get("password") ?? ""),
          deviceSessionId: String(
            formData?.get("deviceSessionId") ?? "form-session",
          ),
        })
      : adminSchema.parse(await request.json());
    const configuredEmail =
      process.env.EDUPULSE_ADMIN_EMAIL ??
      process.env.EDUPLUSE_ADMIN_EMAIL ??
      "edupluse@admin.com";
    const configuredPassword =
      process.env.EDUPULSE_ADMIN_PASSWORD ??
      process.env.EDUPLUSE_ADMIN_PASSWORD ??
      "123098xyy";

    const key = attemptKey(request, body.email);

    if (isBlocked(key)) {
      if (formRequest) {
        return NextResponse.redirect(
          new URL("/login?error=locked", request.url),
        );
      }

      return NextResponse.json(
        { ok: false, error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    const emailMatches =
      body.email.trim().toLowerCase() === configuredEmail.toLowerCase();
    const passwordMatches = secureEqual(body.password, configuredPassword);

    if (!emailMatches || !passwordMatches) {
      registerFailure(key);

      if (formRequest) {
        return NextResponse.redirect(
          new URL("/login?error=invalid", request.url),
        );
      }

      return NextResponse.json(
        { ok: false, error: "Invalid email or password." },
        { status: 401 },
      );
    }

    failedAttempts.delete(key);

    const token = await signAppSession({
      uid: `local-admin:${digest(configuredEmail).toString("hex").slice(0, 16)}`,
      email: configuredEmail,
      displayName: "EduPulse Admin",
      role: "admin",
      orgId: "11111111-1111-4111-8111-111111111111",
      orgName: "EduPulse Academy Network",
      deviceSessionId: body.deviceSessionId,
      photoURL: null,
      onboardingCompleted: true,
    });

    const response = formRequest
      ? NextResponse.redirect(new URL("/admin", request.url))
      : NextResponse.json({
          ok: true,
          role: "admin",
          orgId: "11111111-1111-4111-8111-111111111111",
          orgName: "EduPulse Academy Network",
          onboardingCompleted: true,
        });
    response.cookies.set(sessionCookieName, token, sessionCookieOptions());

    return response;
  } catch {
    if (formRequest) {
      return NextResponse.redirect(
        new URL("/login?error=invalid", request.url),
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unable to sign in." },
      { status: 400 },
    );
  }
}
