import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { verifyFirebaseBearerToken } from "@/lib/firebase/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { aiSystemPrompt, fallbackAiResponse } from "@/lib/ai/prompts";

export const runtime = "nodejs";

const schema = z.object({
  topic: z.string().min(2).max(240),
  className: z.string().min(2).max(160),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  orgId: z.string().min(1).default("org-lumina-academy"),
});

export async function POST(request: Request) {
  try {
    const auth = await verifyFirebaseBearerToken(request);
    const body = schema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ text: fallbackAiResponse("quiz"), demo: true });
    }

    const prompt = `Draft five ${body.difficulty} quiz questions for ${body.className} on ${body.topic}. Include answer keys and one remediation hint per question.`;
    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
      system: aiSystemPrompt("teacher"),
      prompt,
    });

    await getSupabaseServiceClient()?.from("ai_interactions").insert({
      org_id: body.orgId,
      firebase_uid: auth.uid,
      role: "teacher",
      kind: "quiz_generation",
      prompt,
      response: result.text,
    });

    return Response.json({ text: result.text, demo: false });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create quiz draft.",
      },
      { status: 400 },
    );
  }
}
