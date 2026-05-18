import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { verifyFirebaseBearerToken } from "@/lib/firebase/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { aiSystemPrompt, fallbackAiResponse } from "@/lib/ai/prompts";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  content: z.string().min(20).max(6000),
  role: z
    .enum(["student", "teacher", "admin", "super_admin"])
    .default("student"),
  orgId: z.string().min(1).default("org-lumina-academy"),
});

export async function POST(request: Request) {
  try {
    const auth = await verifyFirebaseBearerToken(request);
    const body = schema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ text: fallbackAiResponse("summary"), demo: true });
    }

    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
      system: aiSystemPrompt(body.role as Role),
      prompt: `Summarize this learning material into key points, likely misconceptions, and next study steps:\n\n${body.content}`,
    });

    await getSupabaseServiceClient()
      ?.from("ai_interactions")
      .insert({
        org_id: body.orgId,
        firebase_uid: auth.uid,
        role: body.role,
        kind: "note_summary",
        prompt: body.content.slice(0, 1000),
        response: result.text,
      });

    return Response.json({ text: result.text, demo: false });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to summarize content.",
      },
      { status: 400 },
    );
  }
}
