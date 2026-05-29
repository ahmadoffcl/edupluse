import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(160),
  institute: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || null),
  subject: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || "Support request"),
  message: z.string().trim().min(10).max(2000),
});

function isMissingContactTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    Boolean(candidate.message?.includes("contact_requests"))
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Support inbox is not available right now." },
      { status: 503 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Please fill the contact form correctly." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("contact_requests").insert({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    institute: parsed.data.institute,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: "open",
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: isMissingContactTable(error)
          ? "Support inbox is being configured. Please try again later."
          : "Unable to send your message right now.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
