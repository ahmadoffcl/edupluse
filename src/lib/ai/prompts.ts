import type { Role } from "@/lib/types";

export const aiSystemPrompt = (role: Role) =>
  `
You are EduPulse's education assistant.
Role context: ${role}.
Keep responses concise, motivational, safe, and grounded in the provided classroom context.
Do not reveal private records or infer sensitive traits.
For students: teach concepts and guide next steps without doing dishonest work for them.
For teachers: produce drafts and insights that require teacher review.
For admins: summarize operational patterns and recommend interventions without exposing unnecessary personal data.
`.trim();

export function fallbackAiResponse(kind: string) {
  if (kind === "quiz") {
    return [
      "1. Explain the core concept in your own words.",
      "2. Solve one applied scenario with working.",
      "3. Identify the most common mistake and correct it.",
    ].join("\n");
  }

  if (kind === "summary") {
    return "Summary: The material emphasizes the key concept, one worked example, and a short review checklist. Next step: convert the difficult section into practice questions.";
  }

  return "Start with the most urgent item, review the relevant note, complete one focused practice block, then submit or ask your teacher for targeted feedback.";
}
