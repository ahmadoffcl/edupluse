import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetNoticeEmail } from "@/lib/email/server";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const result = await sendPasswordResetNoticeEmail({
    to: parsed.data.email,
  }).catch((error) => {
    console.warn(
      "Password reset notice email failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { skipped: true, reason: "send-failed" };
  });

  return NextResponse.json({ ok: true, ...result });
}
