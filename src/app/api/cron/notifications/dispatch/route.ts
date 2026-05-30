import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import {
  dispatchDueTimetableNotifications,
  materializeTimetableNotifications,
} from "@/lib/timetable/scheduler";

export const runtime = "nodejs";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase service client is not configured." },
      { status: 503 },
    );
  }

  const materialized = await materializeTimetableNotifications({ supabase });
  const dispatched = await dispatchDueTimetableNotifications({ supabase });

  return NextResponse.json({
    ok: !materialized.error && !dispatched.error,
    materialized,
    dispatched,
  });
}
