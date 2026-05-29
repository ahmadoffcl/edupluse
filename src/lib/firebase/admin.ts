import "server-only";

import { createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isDemoModeEnabled } from "@/lib/config";

let app: App | undefined;

type FirebaseAdminCredential = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};
type FirebaseTokenHeader = {
  alg?: string;
  kid?: string;
};
type FirebaseTokenPayload = {
  aud?: string;
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
};
type FirebasePublicCertCache = {
  certs: Record<string, string>;
  expiresAt: number;
};

const firebaseCertsUrl =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let publicCertCache: FirebasePublicCertCache | null = null;

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

function firebaseProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

function credentialFromServiceAccountJson(
  raw: string,
): FirebaseAdminCredential {
  const account = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  return {
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key,
  };
}

function getFirebaseAdminCredential(): FirebaseAdminCredential | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return credentialFromServiceAccountJson(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    );
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      return credentialFromServiceAccountJson(
        readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"),
      );
    } catch {
      // Keep auth recoverable if the local file is moved; env credentials below
      // can still be used without restarting the dev server.
    }
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey(),
  };
}

function getAdminApp() {
  if (app) return app;

  const credential = getFirebaseAdminCredential();

  if (
    !credential?.projectId ||
    !credential.clientEmail ||
    !credential.privateKey
  ) {
    return null;
  }

  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credential.projectId,
        clientEmail: credential.clientEmail,
        privateKey: credential.privateKey,
      }),
    });

  return app;
}

export function getFirebaseAdminAuth() {
  const adminApp = safeGetAdminApp();
  return adminApp ? getAuth(adminApp) : null;
}

function safeGetAdminApp() {
  try {
    return getAdminApp();
  } catch (error) {
    console.warn(
      "Firebase Admin initialization skipped",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
}

async function getFirebasePublicCerts() {
  const now = Date.now();
  if (publicCertCache && publicCertCache.expiresAt > now) {
    return publicCertCache.certs;
  }

  const response = await fetch(firebaseCertsUrl, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("Firebase public keys are unavailable.");
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await response.json()) as Record<string, string>;

  publicCertCache = {
    certs,
    expiresAt: now + Math.max(maxAgeSeconds - 60, 60) * 1000,
  };

  return certs;
}

async function verifyFirebaseIdTokenWithPublicKeys(token: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid Firebase bearer token.");
  }

  const header = decodeJwtPart<FirebaseTokenHeader>(encodedHeader);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid Firebase token header.");
  }

  const cert = (await getFirebasePublicCerts())[header.kid];
  if (!cert) {
    throw new Error("Firebase token signing key is unknown.");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  if (!verifier.verify(cert, decodeBase64Url(encodedSignature))) {
    throw new Error("Invalid Firebase token signature.");
  }

  const payload = decodeJwtPart<FirebaseTokenPayload>(encodedPayload);
  const projectId = firebaseProjectId();
  const now = Math.floor(Date.now() / 1000);

  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  if (payload.aud !== projectId) {
    throw new Error("Firebase token audience is invalid.");
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Firebase token issuer is invalid.");
  }

  if (!payload.sub || payload.sub.length > 128) {
    throw new Error("Firebase token subject is invalid.");
  }

  if (!payload.exp || payload.exp <= now) {
    throw new Error("Firebase token has expired.");
  }

  if (!payload.iat || payload.iat > now + 300) {
    throw new Error("Firebase token issued-at time is invalid.");
  }

  return {
    uid: payload.sub,
    email: payload.email ?? null,
    demo: false,
  };
}

export async function verifyFirebaseBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    if (isDemoModeEnabled()) {
      return {
        uid: "demo-user",
        email: "demo@edupulse.local",
        demo: true,
      };
    }

    throw new Error("Missing Firebase bearer token.");
  }

  const adminApp = safeGetAdminApp();

  if (!adminApp) {
    return verifyFirebaseIdTokenWithPublicKeys(token);
  }

  let decoded: Awaited<ReturnType<ReturnType<typeof getAuth>["verifyIdToken"]>>;
  try {
    decoded = await getAuth(adminApp).verifyIdToken(token);
  } catch {
    return verifyFirebaseIdTokenWithPublicKeys(token);
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    demo: false,
  };
}
