import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { verifyFirebaseBearerToken } from "@/lib/firebase/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { aiSystemPrompt, fallbackAiResponse } from "@/lib/ai/prompts";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  prompt: z.string().min(2).max(2000),
  role: z
    .enum(["student", "teacher", "admin", "super_admin"])
    .default("student"),
  orgId: z.string().min(1).default("org-lumina-academy"),
  context: z.string().max(3000).optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await verifyFirebaseBearerToken(request);
    const body = schema.parse(await request.json());

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        text: fallbackAiResponse("study"),
        demo: true,
      });
    }

    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
      system: aiSystemPrompt(body.role as Role),
      prompt: [
        `Organization: ${body.orgId}`,
        `Authenticated UID: ${auth.uid}`,
        body.context ? `Context:\n${body.context}` : null,
        `User request:\n${body.prompt}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    const supabase = getSupabaseServiceClient();
    await supabase?.from("ai_interactions").insert({
      org_id: body.orgId,
      firebase_uid: auth.uid,
      role: body.role,
      kind: "study_assistant",
      prompt: body.prompt,
      response: result.text,
    });

    return Response.json({ text: result.text, demo: false });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate response.",
      },
      { status: 400 },
    );
  }
}
