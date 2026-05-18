import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

function credentialFromServiceAccountJson(raw) {
  const account = JSON.parse(raw);

  return {
    projectId: account.project_id,
    clientEmail: account.client_email,
    privateKey: account.private_key,
  };
}

function getCredential() {
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
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

const { projectId, clientEmail, privateKey } = getCredential();

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH, FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
  );
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const auth = getAuth();
let pageToken;
let updated = 0;

do {
  const result = await auth.listUsers(1000, pageToken);
  await Promise.all(
    result.users.map(async (user) => {
      const currentClaims = user.customClaims ?? {};
      if (currentClaims.role === "authenticated") return;

      await auth.setCustomUserClaims(user.uid, {
        ...currentClaims,
        role: "authenticated",
      });
      updated += 1;
    }),
  );
  pageToken = result.pageToken;
} while (pageToken);

console.log(`Updated ${updated} Firebase users with role=authenticated.`);
