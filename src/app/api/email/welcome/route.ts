import { NextResponse } from "next/server";
import { getCurrentAppSession } from "@/lib/auth/server";
import { sendWelcomeEmail } from "@/lib/email/server";

export const runtime = "nodejs";

export async function POST() {
  const session = await getCurrentAppSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await sendWelcomeEmail({
    to: session.email,
    displayName: session.displayName,
    role: session.role,
  }).catch((error) => {
    console.warn(
      "Welcome email failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { skipped: true, reason: "send-failed" };
  });

  return NextResponse.json({ ok: true, ...result });
}
