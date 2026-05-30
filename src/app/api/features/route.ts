import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/server/feature-flags";

export const runtime = "nodejs";

export async function GET() {
  const flags = await getFeatureFlags();
  return NextResponse.json({ ok: true, flags });
}
