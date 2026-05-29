import { describe, expect, it } from "vitest";
import {
  computeAiRisk,
  computeSimilarity,
  normalizeComparableText,
  removeCoverPage,
} from "@/lib/integrity/scoring";

describe("integrity report helpers", () => {
  it("removes a likely cover page before comparison", () => {
    const result = removeCoverPage(
      [
        "Assignment Title\nSubmitted by Ahmad\nSubmitted to Professor\nDepartment BSCS",
        "",
        "",
        "The actual solution starts here with data structures and algorithms details.",
      ].join("\n"),
    );

    expect(result.excluded).toBe(true);
    expect(result.text).toContain("actual solution");
    expect(result.text).not.toContain("Submitted by");
  });

  it("keeps content when no cover page signal exists", () => {
    const result = removeCoverPage(
      "This paragraph is the actual answer. It explains the implementation with examples.",
    );

    expect(result.excluded).toBe(false);
    expect(result.text).toContain("actual answer");
  });

  it("detects similarity from shared n-gram overlap", () => {
    const shared = [
      "binary search tree insertion traversal balancing recursion node height rotation",
      "the algorithm compares keys recursively and updates parent references",
      "each node stores left right child links and supports ordered lookup",
      "time complexity depends on height and improves after balancing",
    ].join(" ");
    const target = `${shared} ${shared} unique target explanation for the submitted assignment`;
    const peer = `${shared} ${shared} unique peer explanation with slightly different ending`;

    const matches = computeSimilarity(
      {
        id: "target",
        text: target,
        comparableText: normalizeComparableText(target),
      },
      [
        {
          id: "peer",
          studentId: "student-2",
          studentName: "Student Two",
          text: peer,
          comparableText: normalizeComparableText(peer),
        },
      ],
    );

    expect(matches[0]?.score).toBeGreaterThan(20);
    expect(matches[0]?.snippets.length).toBeGreaterThan(0);
  });

  it("returns evidence-based AI risk without final accusation", () => {
    const text = Array.from({ length: 30 })
      .map(
        () =>
          "Moreover, it is important to note that this comprehensive understanding plays a crucial role in the significant impact of the topic.",
      )
      .join(" ");

    const result = computeAiRisk(text);

    expect(result.score).toBeGreaterThan(40);
    expect(result.explanation).toContain("not proof");
  });
});
