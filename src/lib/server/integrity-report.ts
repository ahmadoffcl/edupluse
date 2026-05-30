import "server-only";
import { createHash } from "node:crypto";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  computeAiRisk,
  computeSimilarity,
  countWords,
  normalizeComparableText,
  removeCoverPage,
  type AiRiskResult,
  type IntegrityRiskBand,
  type SimilarityMatchResult,
} from "@/lib/integrity/scoring";
import { extractPdfText } from "@/lib/server/pdf-text";
import type { WorkflowContext } from "@/lib/server/workflow-auth";

type DbRecord = Record<string, unknown>;

export type ExtractedSubmissionText = {
  text: string;
  comparableText: string;
  wordCount: number;
  textHash: string | null;
  status: "ready" | "unsupported" | "empty" | "failed";
  reason: string | null;
  excludedCoverPage: boolean;
  mimeType: string | null;
  originalFilename: string | null;
};

type SubmissionRecord = {
  id: string;
  org_id: string;
  assignment_id: string;
  student_id: string;
  content: string | null;
  file_path: string | null;
  mime_type: string | null;
  original_filename: string | null;
  file_size: number | null;
  submitted_at: string;
  profiles?: DbRecord | DbRecord[] | null;
};

type AssignmentRecord = {
  id: string;
  title: string;
  class_id: string;
  classes?: DbRecord | DbRecord[] | null;
};

function relation(row: DbRecord, key: string) {
  const value = row[key];
  if (Array.isArray(value)) return value[0] as DbRecord | undefined;
  if (value && typeof value === "object") return value as DbRecord;
  return undefined;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function hashText(text: string) {
  if (!text.trim()) return null;
  return createHash("sha256").update(text).digest("hex");
}

function inferMimeType(filename: string | null, explicit: string | null) {
  if (explicit) return explicit;
  const lower = filename?.toLowerCase() ?? "";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  return null;
}

async function textFromBuffer(buffer: Buffer, mimeType: string | null) {
  if (mimeType === "text/plain" || mimeType === "text/csv") {
    return buffer.toString("utf8");
  }

  if (mimeType === "application/pdf") {
    const result = await extractPdfText(buffer);
    return result.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return null;
}

export async function extractSubmissionText(
  context: WorkflowContext,
  submission: SubmissionRecord,
): Promise<ExtractedSubmissionText> {
  const originalFilename =
    submission.original_filename ??
    submission.file_path?.split("/").pop() ??
    null;
  const mimeType = inferMimeType(originalFilename, submission.mime_type);
  const chunks: string[] = [];

  if (submission.content?.trim()) chunks.push(submission.content.trim());

  try {
    if (submission.file_path) {
      const { data, error } = await context.supabase.storage
        .from("submissions")
        .download(submission.file_path);

      if (error) {
        return {
          text: chunks.join("\n\n"),
          comparableText: normalizeComparableText(chunks.join("\n\n")),
          wordCount: countWords(chunks.join("\n\n")),
          textHash: hashText(normalizeComparableText(chunks.join("\n\n"))),
          status: chunks.length ? "ready" : "failed",
          reason: "Submission file could not be downloaded.",
          excludedCoverPage: false,
          mimeType,
          originalFilename,
        };
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      const fileText = await textFromBuffer(buffer, mimeType);
      if (fileText) chunks.push(fileText);
      else if (!chunks.length) {
        return {
          text: "",
          comparableText: "",
          wordCount: 0,
          textHash: null,
          status: "unsupported",
          reason:
            "This file type can be previewed manually but is not deeply analyzable yet.",
          excludedCoverPage: false,
          mimeType,
          originalFilename,
        };
      }
    }
  } catch {
    return {
      text: chunks.join("\n\n"),
      comparableText: normalizeComparableText(chunks.join("\n\n")),
      wordCount: countWords(chunks.join("\n\n")),
      textHash: hashText(normalizeComparableText(chunks.join("\n\n"))),
      status: chunks.length ? "ready" : "failed",
      reason: "Text extraction failed for this submission.",
      excludedCoverPage: false,
      mimeType,
      originalFilename,
    };
  }

  const rawText = chunks.join("\n\n").trim();
  if (!rawText) {
    return {
      text: "",
      comparableText: "",
      wordCount: 0,
      textHash: null,
      status: "empty",
      reason: "No readable text was found in this submission.",
      excludedCoverPage: false,
      mimeType,
      originalFilename,
    };
  }

  const withoutCover = removeCoverPage(rawText);
  const comparableText = normalizeComparableText(withoutCover.text);

  return {
    text: rawText,
    comparableText,
    wordCount: countWords(comparableText),
    textHash: hashText(comparableText),
    status: comparableText ? "ready" : "empty",
    reason: comparableText
      ? null
      : "No comparable text remained after cleanup.",
    excludedCoverPage: withoutCover.excluded,
    mimeType,
    originalFilename,
  };
}

async function loadSubmissionBundle(
  context: WorkflowContext,
  assignmentId: string,
  submissionId: string,
) {
  const { data: assignment, error: assignmentError } = await context.supabase
    .from("assignments")
    .select("id,title,class_id,classes(name,section)")
    .eq("id", assignmentId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (assignmentError || !assignment) {
    throw new Error("Assignment was not found.");
  }

  const { data: submission, error: submissionError } = await context.supabase
    .from("submissions")
    .select(
      "id,org_id,assignment_id,student_id,status,content,file_path,file_size,mime_type,original_filename,submitted_at,profiles(display_name,username,email)",
    )
    .eq("id", submissionId)
    .eq("assignment_id", assignmentId)
    .eq("org_id", context.session.orgId)
    .maybeSingle();

  if (submissionError || !submission) {
    throw new Error("Submission was not found.");
  }

  return {
    assignment: assignment as AssignmentRecord,
    submission: submission as SubmissionRecord,
  };
}

function reportGuidance(
  aiRisk: AiRiskResult,
  similarity: SimilarityMatchResult[],
) {
  const lines = [
    "Use this report as a review aid, not a final accusation.",
    "Ask the student to explain the highlighted sections in their own words.",
  ];
  if (aiRisk.band !== "low") {
    lines.push(
      "Discuss the writing-pattern signals and request process evidence or drafts.",
    );
  }
  if (similarity[0]?.score && similarity[0].score >= 25) {
    lines.push(
      "Compare the matched passages with both students before deciding on any action.",
    );
  }
  return lines.join("\n");
}

async function aiGuidance(
  assignment: AssignmentRecord,
  aiRisk: AiRiskResult,
  similarity: SimilarityMatchResult[],
) {
  const fallback = reportGuidance(aiRisk, similarity);
  if (!process.env.OPENAI_API_KEY) return fallback;

  try {
    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? "gpt-4.1-mini"),
      system:
        "You help teachers review academic integrity evidence fairly. Never accuse. Provide neutral questions and next steps based only on provided evidence.",
      prompt: [
        `Assignment: ${assignment.title}`,
        `AI risk: ${aiRisk.band} (${aiRisk.score}/100)`,
        `Signals: ${aiRisk.signals.join("; ")}`,
        `Highest similarity: ${similarity[0]?.score ?? 0}/100`,
        "Write concise teacher guidance with 3 review questions and one neutral feedback note.",
      ].join("\n"),
    });
    return result.text.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function createIntegrityReport(
  context: WorkflowContext,
  assignmentId: string,
  submissionId: string,
) {
  const { assignment, submission } = await loadSubmissionBundle(
    context,
    assignmentId,
    submissionId,
  );
  const student = relation(submission as unknown as DbRecord, "profiles");
  const extracted = await extractSubmissionText(context, submission);

  const { data: peerRows } = await context.supabase
    .from("submissions")
    .select(
      "id,org_id,assignment_id,student_id,status,content,file_path,file_size,mime_type,original_filename,submitted_at,profiles(display_name,username,email)",
    )
    .eq("org_id", context.session.orgId)
    .eq("assignment_id", assignmentId)
    .neq("id", submissionId)
    .limit(120);

  const peers = await Promise.all(
    ((peerRows ?? []) as SubmissionRecord[]).map(async (peer) => {
      const peerStudent = relation(peer as unknown as DbRecord, "profiles");
      const peerExtracted = await extractSubmissionText(context, peer);
      return {
        id: peer.id,
        studentId: peer.student_id,
        studentName:
          stringValue(peerStudent?.display_name) ||
          stringValue(peerStudent?.username) ||
          "Student",
        text: peerExtracted.text,
        comparableText: peerExtracted.comparableText,
      };
    }),
  );

  const aiRisk =
    extracted.status === "ready"
      ? computeAiRisk(extracted.comparableText)
      : {
          score: 0,
          band: "low" as IntegrityRiskBand,
          signals: [extracted.reason ?? "Submission is not deeply analyzable."],
          explanation:
            "No AI-use risk score was produced because readable text is unavailable.",
        };
  const similarity =
    extracted.status === "ready"
      ? computeSimilarity(
          {
            id: submission.id,
            text: extracted.text,
            comparableText: extracted.comparableText,
          },
          peers,
        )
      : [];
  const highestSimilarity = similarity[0]?.score ?? 0;
  const guidance = await aiGuidance(assignment, aiRisk, similarity);
  const reportStatus =
    extracted.status === "ready"
      ? "ready"
      : extracted.status === "unsupported"
        ? "unsupported"
        : "failed";
  const classRecord = relation(assignment as unknown as DbRecord, "classes");

  const { data: report, error } = await context.supabase
    .from("submission_integrity_reports")
    .upsert(
      {
        org_id: context.session.orgId,
        assignment_id: assignmentId,
        submission_id: submissionId,
        student_id: submission.student_id,
        status: reportStatus,
        ai_risk_score: aiRisk.score,
        ai_risk_band: aiRisk.band,
        similarity_score: highestSimilarity,
        extracted_word_count: extracted.wordCount,
        checked_peer_count: peers.length,
        extracted_text_hash: extracted.textHash,
        extraction_status: extracted.status,
        model_version: "integrity-v1",
        evidence: {
          aiSignals: aiRisk.signals,
          aiExplanation: aiRisk.explanation,
          extractionReason: extracted.reason,
          excludedCoverPage: extracted.excludedCoverPage,
          mimeType: extracted.mimeType,
          originalFilename: extracted.originalFilename,
          assignmentTitle: assignment.title,
          className: stringValue(classRecord?.name),
          studentName:
            stringValue(student?.display_name) ||
            stringValue(student?.username) ||
            "Student",
        },
        guidance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,submission_id" },
    )
    .select("id")
    .single();

  if (error || !report?.id) {
    throw new Error("Unable to save integrity report.");
  }

  await context.supabase
    .from("submission_similarity_matches")
    .delete()
    .eq("report_id", report.id)
    .eq("org_id", context.session.orgId);

  if (similarity.length > 0) {
    await context.supabase.from("submission_similarity_matches").insert(
      similarity.map((match) => ({
        org_id: context.session.orgId,
        report_id: report.id,
        assignment_id: assignmentId,
        source_submission_id: submissionId,
        matched_submission_id: match.submissionId,
        matched_student_id: match.studentId,
        similarity_score: match.score,
        matched_snippets: match.snippets,
        excluded_cover_page: extracted.excludedCoverPage,
      })),
    );
  }

  return getIntegrityReport(context, assignmentId, submissionId);
}

export async function getIntegrityReport(
  context: WorkflowContext,
  assignmentId: string,
  submissionId: string,
) {
  const { assignment, submission } = await loadSubmissionBundle(
    context,
    assignmentId,
    submissionId,
  );
  const student = relation(submission as unknown as DbRecord, "profiles");
  const classRecord = relation(assignment as unknown as DbRecord, "classes");
  const { data: report } = await context.supabase
    .from("submission_integrity_reports")
    .select("*")
    .eq("org_id", context.session.orgId)
    .eq("submission_id", submissionId)
    .maybeSingle();
  const { data: matches } = report?.id
    ? await context.supabase
        .from("submission_similarity_matches")
        .select(
          "id,similarity_score,matched_snippets,matched_submission_id,matched_student_id",
        )
        .eq("org_id", context.session.orgId)
        .eq("report_id", report.id)
        .order("similarity_score", { ascending: false })
    : { data: [] };
  const matchedStudentIds = [
    ...new Set(
      ((matches ?? []) as DbRecord[])
        .map((match) => stringValue(match.matched_student_id))
        .filter(Boolean),
    ),
  ];
  const { data: matchedProfiles } = matchedStudentIds.length
    ? await context.supabase
        .from("profiles")
        .select("id,display_name,username,email")
        .in("id", matchedStudentIds)
    : { data: [] };
  const matchedProfilesById = new Map(
    ((matchedProfiles ?? []) as DbRecord[]).map((profile) => [
      stringValue(profile.id),
      profile,
    ]),
  );
  const signedUrl = submission.file_path
    ? ((
        await context.supabase.storage
          .from("submissions")
          .createSignedUrl(submission.file_path, 60 * 10)
      ).data?.signedUrl ?? null)
    : null;

  return {
    assignment: {
      id: assignment.id,
      title: assignment.title,
      className: stringValue(classRecord?.name, "Classroom"),
      section: stringValue(classRecord?.section) || null,
    },
    submission: {
      id: submission.id,
      studentId: submission.student_id,
      studentName:
        stringValue(student?.display_name) ||
        stringValue(student?.username) ||
        "Student",
      studentUsername: stringValue(student?.username) || null,
      submittedAt: submission.submitted_at,
      content: submission.content,
      filePath: submission.file_path,
      mimeType: submission.mime_type,
      originalFilename:
        submission.original_filename ?? submission.file_path?.split("/").pop(),
      fileSize: submission.file_size,
      signedUrl,
    },
    report: report
      ? {
          id: stringValue(report.id),
          status: stringValue(report.status, "ready"),
          aiRiskScore: numberValue(report.ai_risk_score),
          aiRiskBand: stringValue(report.ai_risk_band, "low"),
          similarityScore: numberValue(report.similarity_score),
          extractedWordCount: numberValue(report.extracted_word_count),
          checkedPeerCount: numberValue(report.checked_peer_count),
          extractionStatus: stringValue(report.extraction_status),
          evidence: report.evidence ?? {},
          guidance: stringValue(report.guidance),
          updatedAt: stringValue(report.updated_at),
        }
      : null,
    matches: ((matches ?? []) as DbRecord[]).map((match) => {
      const matchStudent = matchedProfilesById.get(
        stringValue(match.matched_student_id),
      );
      return {
        id: stringValue(match.id),
        similarityScore: numberValue(match.similarity_score),
        matchedSubmissionId: stringValue(match.matched_submission_id),
        matchedStudentId: stringValue(match.matched_student_id),
        matchedStudentName:
          stringValue(matchStudent?.display_name) ||
          stringValue(matchStudent?.username) ||
          "Student",
        matchedSnippets: Array.isArray(match.matched_snippets)
          ? match.matched_snippets
          : [],
      };
    }),
  };
}
