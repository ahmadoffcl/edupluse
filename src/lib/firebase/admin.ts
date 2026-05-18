import "server-only";

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isDemoModeEnabled } from "@/lib/config";

let app: App | null | undefined;

type FirebaseAdminCredential = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

function privateKey() {
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
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
    return credentialFromServiceAccountJson(
      readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, "utf8"),
    );
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey(),
  };
}

function getAdminApp() {
  if (app !== undefined) return app;

  const credential = getFirebaseAdminCredential();

  if (
    !credential?.projectId ||
    !credential.clientEmail ||
    !credential.privateKey
  ) {
    app = null;
    return app;
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

  const adminApp = getAdminApp();

  if (!adminApp) {
    if (isDemoModeEnabled()) {
      return {
        uid: "demo-user",
        email: "demo@edupulse.local",
        demo: true,
      };
    }

    throw new Error("Firebase Admin credentials are not configured.");
  }

  const decoded = await getAuth(adminApp).verifyIdToken(token);

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    demo: false,
  };
}
