const QUIZ_PATTERN =
  /\b(quiz|test|exam|midterm|mid\s*term|final|viva|assessment|mcq|short\s*questions?)\b/i;

export function classifyAssignmentKind({
  title,
  instructions,
}: {
  title?: string | null;
  instructions?: string | null;
}): "assignment" | "exam" {
  const text = [title, instructions].filter(Boolean).join(" ");
  return QUIZ_PATTERN.test(text) ? "exam" : "assignment";
}

export function assignmentKindLabel(kind: "assignment" | "exam") {
  return kind === "exam" ? "Quiz / exam" : "Assignment";
}

export function assignmentPostedTitle(kind: "assignment" | "exam") {
  return kind === "exam" ? "New quiz posted" : "New assignment";
}

export function assignmentReminderTitle(
  kind: "assignment" | "exam",
  timing: "tomorrow" | "hour",
) {
  if (kind === "exam") {
    return timing === "tomorrow" ? "Quiz is tomorrow" : "Quiz starts in 1 hour";
  }

  return timing === "tomorrow"
    ? "Assignment due tomorrow"
    : "Assignment due in 1 hour";
}
