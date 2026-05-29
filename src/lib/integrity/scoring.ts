export type IntegrityRiskBand = "low" | "medium" | "high";

export type AiRiskResult = {
  score: number;
  band: IntegrityRiskBand;
  signals: string[];
  explanation: string;
};

export type SimilaritySnippet = {
  phrase: string;
  targetSnippet: string;
  matchedSnippet: string;
};

export type SimilarityMatchResult = {
  submissionId: string;
  studentId: string;
  studentName: string;
  score: number;
  snippets: SimilaritySnippet[];
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskBand(score: number): IntegrityRiskBand {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function words(text: string) {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "been",
  "being",
  "between",
  "could",
  "does",
  "each",
  "from",
  "have",
  "into",
  "more",
  "most",
  "only",
  "other",
  "should",
  "such",
  "than",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "used",
  "using",
  "very",
  "were",
  "when",
  "where",
  "which",
  "with",
  "would",
]);

function contentWords(text: string) {
  return words(text).filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function sentences(text: string) {
  return text
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter((item) => item.split(/\s+/).length >= 4);
}

export function countWords(text: string) {
  return words(text).length;
}

export function removeCoverPage(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return { text: "", excluded: false };
  }

  const formFeedPages = normalized
    .split(/\f+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (formFeedPages.length > 1) {
    return { text: formFeedPages.slice(1).join("\n\n"), excluded: true };
  }

  const blocks = normalized
    .split(/\n{3,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  const firstBlock = blocks[0] ?? "";
  const firstWords = words(firstBlock).length;
  const coverSignals = [
    "submitted by",
    "submitted to",
    "assignment",
    "course",
    "department",
    "semester",
    "registration",
    "student id",
    "university",
    "college",
    "institute",
  ];

  if (
    blocks.length > 1 &&
    firstWords <= 220 &&
    coverSignals.some((signal) => firstBlock.toLowerCase().includes(signal))
  ) {
    return { text: blocks.slice(1).join("\n\n"), excluded: true };
  }

  return { text: normalized, excluded: false };
}

export function normalizeComparableText(text: string) {
  return words(text).join(" ");
}

export function computeAiRisk(text: string): AiRiskResult {
  const tokenList = words(text);
  const sentenceList = sentences(text);

  if (tokenList.length < 120) {
    return {
      score: 12,
      band: "low",
      signals: ["Submission text is too short for a strong AI-use signal."],
      explanation:
        "This report does not make a strong AI-use claim because the readable text is short.",
    };
  }

  const uniqueRatio = new Set(tokenList).size / tokenList.length;
  const sentenceLengths = sentenceList.map(
    (sentence) => words(sentence).length,
  );
  const averageSentence =
    sentenceLengths.reduce((total, item) => total + item, 0) /
    Math.max(1, sentenceLengths.length);
  const variance =
    sentenceLengths.reduce(
      (total, item) => total + Math.pow(item - averageSentence, 2),
      0,
    ) / Math.max(1, sentenceLengths.length);
  const phraseList = [
    "it is important to note",
    "in conclusion",
    "moreover",
    "furthermore",
    "delve into",
    "plays a crucial role",
    "multifaceted",
    "significant impact",
    "comprehensive understanding",
  ];
  const lower = text.toLowerCase();
  const phraseHits = phraseList.filter((phrase) => lower.includes(phrase));
  const semicolonDensity =
    (text.match(/[;:]/g)?.length ?? 0) / tokenList.length;
  const firstPersonCount = tokenList.filter((word) =>
    ["i", "me", "my", "we", "our"].includes(word),
  ).length;

  let score = 10;
  const signals: string[] = [];

  if (uniqueRatio < 0.34) {
    score += 16;
    signals.push("Vocabulary variety is unusually low for the text length.");
  }
  if (averageSentence > 24) {
    score += 14;
    signals.push("Average sentence length is high and consistently formal.");
  }
  if (variance < 28 && sentenceList.length >= 8) {
    score += 14;
    signals.push("Sentence rhythm is unusually even across the submission.");
  }
  if (phraseHits.length > 0) {
    score += Math.min(22, phraseHits.length * 7);
    signals.push(
      `Common generic academic phrasing found: ${phraseHits.join(", ")}.`,
    );
  }
  if (semicolonDensity > 0.018) {
    score += 10;
    signals.push("Punctuation density suggests heavily polished prose.");
  }
  if (firstPersonCount === 0 && tokenList.length > 400) {
    score += 8;
    signals.push("No personal process language appears in a long response.");
  }

  const finalScore = clampScore(score);
  if (signals.length === 0) {
    signals.push("No strong AI-use writing-pattern signals were detected.");
  }

  return {
    score: finalScore,
    band: riskBand(finalScore),
    signals,
    explanation:
      "This is an evidence score from writing patterns only. It is not proof and should be paired with teacher review.",
  };
}

function ngrams(tokenList: string[], size = 8) {
  const set = new Set<string>();
  for (let index = 0; index <= tokenList.length - size; index += 1) {
    set.add(tokenList.slice(index, index + size).join(" "));
  }
  return set;
}

function overlapScore(targetSet: Set<string>, peerSet: Set<string>) {
  const shared = [...targetSet].filter((item) => peerSet.has(item));
  const denominator = Math.max(1, Math.min(targetSet.size, peerSet.size));
  return {
    score: clampScore((shared.length / denominator) * 100),
    shared,
  };
}

function contentCoverageScore(targetText: string, peerText: string) {
  const targetSet = new Set(contentWords(targetText));
  const peerSet = new Set(contentWords(peerText));
  if (targetSet.size < 18 || peerSet.size < 18) return 0;
  const shared = [...targetSet].filter((item) => peerSet.has(item));
  const denominator = Math.max(1, Math.min(targetSet.size, peerSet.size));
  return clampScore((shared.length / denominator) * 100);
}

function snippetAround(text: string, phrase: string) {
  const normalized = text.toLowerCase();
  const phraseStart = normalized.indexOf(
    phrase.split(" ").slice(0, 4).join(" "),
  );
  if (phraseStart < 0) return phrase;
  const start = Math.max(0, phraseStart - 120);
  const end = Math.min(text.length, phraseStart + phrase.length + 180);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function computeSimilarity(
  target: { id: string; text: string; comparableText: string },
  peers: Array<{
    id: string;
    studentId: string;
    studentName: string;
    text: string;
    comparableText: string;
  }>,
): SimilarityMatchResult[] {
  const targetTokens = words(target.comparableText);
  if (targetTokens.length < 40) return [];
  const targetFiveSet = ngrams(targetTokens, 5);
  const targetEightSet = ngrams(targetTokens, 8);
  const targetTwelveSet = ngrams(targetTokens, 12);

  return peers
    .map((peer) => {
      const peerTokens = words(peer.comparableText);
      if (peerTokens.length < 40) return null;
      const five = overlapScore(targetFiveSet, ngrams(peerTokens, 5));
      const eight = overlapScore(targetEightSet, ngrams(peerTokens, 8));
      const twelve = overlapScore(targetTwelveSet, ngrams(peerTokens, 12));
      const contentCoverage = contentCoverageScore(
        target.comparableText,
        peer.comparableText,
      );
      const blended =
        five.score * 0.54 +
        eight.score * 0.32 +
        twelve.score * 0.1 +
        contentCoverage * 0.04;
      const score = clampScore(Math.max(eight.score, twelve.score, blended));

      if (score < 10) return null;

      const snippetPhrases = [
        ...twelve.shared,
        ...eight.shared,
        ...five.shared,
      ].slice(0, 5);
      const snippets = snippetPhrases.map((phrase) => ({
        phrase,
        targetSnippet: snippetAround(target.text, phrase),
        matchedSnippet: snippetAround(peer.text, phrase),
      }));

      return {
        submissionId: peer.id,
        studentId: peer.studentId,
        studentName: peer.studentName,
        score,
        snippets,
      };
    })
    .filter((item): item is SimilarityMatchResult => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
