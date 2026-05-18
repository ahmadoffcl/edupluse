import type { Role } from "@/lib/types";

export const sessionCookieName = "lumina_session";

export type AppSession = {
  uid: string;
  email: string | null;
  displayName: string;
  role: Role;
  orgId: string;
  orgName: string;
  deviceSessionId: string;
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("APP_SESSION_SECRET is required in production.");
  }

  return secret ?? "lumina-local-development-session-secret-change-me";
}

function base64UrlEncode(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(message: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;

  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

export async function signAppSession(
  session: Omit<AppSession, "exp"> & { maxAgeSeconds?: number },
) {
  const { maxAgeSeconds = 60 * 60 * 8, ...payload } = session;
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ ...payload, exp })),
  );
  const signature = await hmac(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAppSession(token: string | undefined | null) {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = await hmac(encodedPayload);
  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload)),
    ) as AppSession;

    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
