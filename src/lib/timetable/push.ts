import "server-only";
import webPush from "web-push";

let configured = false;

export type PushPayload = {
  title: string;
  body: string;
  url?: string | null;
  tag?: string | null;
  icon?: string;
  kind?: string;
};

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function webPushConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configureWebPush() {
  if (configured || !webPushConfigured()) return webPushConfigured();

  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export async function sendWebPushNotification(
  subscription: StoredPushSubscription,
  payload: PushPayload,
) {
  if (!configureWebPush()) {
    return {
      ok: false,
      statusCode: 0,
      error: "Web Push is not configured.",
    };
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        icon: "/edupulse-logo.svg",
        badge: "/edupulse-logo.svg",
        ...payload,
      }),
    );

    return { ok: true, statusCode: 200, error: null };
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode)
        : 0;
    const message =
      error instanceof Error ? error.message : "Unable to send push.";

    return { ok: false, statusCode, error: message };
  }
}
