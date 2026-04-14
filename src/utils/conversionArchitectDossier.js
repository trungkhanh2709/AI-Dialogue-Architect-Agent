const WORD_RE = /[a-z][a-z'-]{2,}/gi;

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "always",
  "and",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "could",
  "from",
  "have",
  "here",
  "into",
  "just",
  "like",
  "maybe",
  "more",
  "most",
  "need",
  "next",
  "onto",
  "only",
  "other",
  "over",
  "really",
  "same",
  "should",
  "some",
  "that",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "those",
  "through",
  "very",
  "want",
  "with",
  "would",
  "your",
  "you're",
  "youve",
  "ours",
  "ourselves",
  "hers",
  "himself",
  "herself",
  "ours",
  "theirs",
  "what",
  "when",
  "where",
  "which",
  "while",
  "will",
  "were",
  "than",
  "than",
  "cant",
  "dont",
  "doesnt",
  "didnt",
  "theyre",
  "lets",
  "okay",
  "yeah",
  "yep",
  "sure",
  "well",
  "even",
  "much",
  "many",
  "still",
  "been",
  "make",
  "made",
  "makes",
  "said",
  "says",
  "saying",
  "going",
  "getting",
  "got",
  "our",
  "their",
  "the",
  "for",
  "are",
  "but",
  "not",
  "you",
  "its",
  "it's",
  "was",
  "too",
  "can",
  "how",
  "why",
  "who",
  "his",
  "her",
  "has",
  "had",
  "did",
  "does",
  "our",
  "out",
  "use",
  "using",
]);

const PAIN_POINT_RE =
  /\b(problem|issue|pain|concern|worried|worry|frustrat|stuck|blocker|delay|slow|manual|complex|hard|difficult|budget|cost|price|pricing|timeline|deadline|risk|security|compliance|integration|migration|roi|approval|resource|capacity|uncertain|uncertainty)\b/i;

const POSITIVE_RE =
  /\b(yes|good|great|helpful|interested|aligned|works|workable|makes sense|sounds good|love|like|open to|happy|comfortable)\b/i;

const NEGATIVE_RE =
  /\b(not sure|concern|worried|problem|issue|stuck|hard|difficult|can't|cannot|won't|budget|cost|delay|risk|skeptic|skeptical|unsure|frustrat|blocked|objection)\b/i;

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function clipText(value, max = 160) {
  const text = cleanText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function safeParseJson(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseTranscriptLine(line, index) {
  const raw = String(line || "").trim();
  if (!raw) return null;

  const match = raw.match(/^\s*([^:]+):\s*(.*)$/);
  if (!match) return null;

  return {
    index,
    speaker: cleanText(match[1]) || "Speaker",
    text: cleanText(match[2]),
  };
}

function parseTranscript(transcriptText) {
  const lines = Array.isArray(transcriptText)
    ? transcriptText
    : String(transcriptText || "").split(/\r?\n/);

  return lines
    .map((line, index) => parseTranscriptLine(line, index))
    .filter((entry) => entry && entry.text);
}

function buildSelfAliasSet(meetingData, selfNames = []) {
  const values = [
    meetingData?.userName,
    meetingData?.userNameAndRole,
    meetingData?.entity_name,
    ...selfNames,
  ];

  return new Set(values.map(normalizeKey).filter(Boolean));
}

function isSelfSpeaker(speaker, selfAliases) {
  const normalized = normalizeKey(speaker);
  if (!normalized) return false;
  return selfAliases.has(normalized);
}

function extractProspectEntries(entries, selfAliases) {
  return entries.filter(
    (entry) =>
      !isSelfSpeaker(entry.speaker, selfAliases) &&
      normalizeKey(entry.speaker) !== "agent"
  );
}

function extractKeywords(entries, limit = 8) {
  const counts = new Map();

  entries.forEach((entry) => {
    const matches = String(entry.text || "").toLowerCase().match(WORD_RE) || [];
    matches.forEach((word) => {
      if (STOPWORDS.has(word) || word.length < 3) return;
      counts.set(word, (counts.get(word) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function extractPainPoints(entries, limit = 4) {
  const seen = new Set();
  const painPoints = [];

  entries.forEach((entry) => {
    if (!PAIN_POINT_RE.test(entry.text)) return;
    const snippet = clipText(entry.text, 110);
    const key = normalizeKey(snippet);
    if (!key || seen.has(key)) return;
    seen.add(key);
    painPoints.push(snippet);
  });

  return painPoints.slice(0, limit);
}

function inferStage(text) {
  if (/\b(price|pricing|budget|cost|roi|contract|legal)\b/i.test(text)) {
    return "Objection Handling";
  }
  if (/\b(timeline|deadline|integration|migration|implementation|scope)\b/i.test(text)) {
    return "Solution Framing";
  }
  if (/\b(next step|proposal|follow up|decision|close|closing)\b/i.test(text)) {
    return "Closing";
  }
  if (/\b(problem|challenge|need|goal|pain)\b/i.test(text)) {
    return "Discovery";
  }
  return "Active Discussion";
}

function buildNarrativeArc(entries, selfAliases, limit = 5) {
  const arc = [];
  const seen = new Set();

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (isSelfSpeaker(entry.speaker, selfAliases)) continue;

    const event = clipText(entry.text, 120);
    const eventKey = normalizeKey(event);
    if (!eventKey || seen.has(eventKey)) continue;
    seen.add(eventKey);

    let response = "";
    for (let next = index + 1; next < entries.length; next += 1) {
      if (isSelfSpeaker(entries[next].speaker, selfAliases)) {
        response = clipText(entries[next].text, 110);
        break;
      }
    }

    arc.push({
      stage: inferStage(entry.text),
      event: `Prospect raised: ${event}`,
      outcome: response ? `Responded with: ${response}` : "Open loop remains.",
    });

    if (arc.length >= limit) break;
  }

  return arc;
}

function inferSentiment(entries) {
  const recent = entries.slice(-5);
  let positive = 0;
  let negative = 0;

  recent.forEach((entry) => {
    if (POSITIVE_RE.test(entry.text)) positive += 1;
    if (NEGATIVE_RE.test(entry.text)) negative += 1;
  });

  if (negative > positive) return "Skeptical";
  if (positive > negative) return "Positive";
  return "Neutral";
}

function inferRemainingFriction(entries, fallback = "") {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const text = cleanText(entries[index].text);
    if (!text) continue;
    if (PAIN_POINT_RE.test(text)) return clipText(text, 140);
  }

  const lastEntry = entries[entries.length - 1];
  if (lastEntry?.text) return clipText(lastEntry.text, 140);
  return cleanText(fallback);
}

function inferNextObjective(remainingFriction) {
  const friction = String(remainingFriction || "");
  if (!friction) {
    return "Secure one concrete next step and confirm decision ownership.";
  }
  if (/\b(price|pricing|budget|cost|roi)\b/i.test(friction)) {
    return "Reframe the value against budget pressure and test buying criteria.";
  }
  if (/\b(timeline|deadline|integration|migration|implementation|scope)\b/i.test(friction)) {
    return "Reduce delivery risk and lock a realistic implementation path.";
  }
  if (/\b(security|compliance|legal|risk)\b/i.test(friction)) {
    return "Address the risk blocker directly and identify the approver needed.";
  }
  return "Clarify the unresolved friction and move the prospect to one commitment.";
}

function buildProspectSummary(meetingData, painPoints, keywords, fallbackSummary = "") {
  const parts = [];
  if (meetingData?.prospectName) parts.push(`Name: ${meetingData.prospectName}.`);
  if (meetingData?.customerCompanyName) {
    parts.push(`Company: ${meetingData.customerCompanyName}.`);
  }
  if (meetingData?.customerCompanyServices) {
    parts.push(`Business: ${clipText(meetingData.customerCompanyServices, 140)}.`);
  }
  if (painPoints.length) {
    parts.push(`Key pain points: ${painPoints.join("; ")}.`);
  }
  if (keywords.length) {
    parts.push(`Keywords: ${keywords.join(", ")}.`);
  }

  const summary = parts.join(" ").trim();
  return summary || cleanText(fallbackSummary) || "Prospect summary unavailable.";
}

export function parseConversionArchitectDossier(value) {
  return safeParseJson(value);
}

export function buildConversionArchitectDossier({
  meetingData,
  transcriptText,
  existingDossierText,
  selfNames = [],
}) {
  const existing = parseConversionArchitectDossier(existingDossierText);
  const entries = parseTranscript(transcriptText);

  if (!entries.length) {
    return cleanText(existingDossierText);
  }

  const selfAliases = buildSelfAliasSet(meetingData, selfNames);
  const prospectEntries = extractProspectEntries(entries, selfAliases);
  const keywords = extractKeywords(prospectEntries);
  const painPoints = extractPainPoints(prospectEntries);
  const newArc = buildNarrativeArc(entries, selfAliases);
  const existingArc = Array.isArray(existing?.narrative_arc)
    ? existing.narrative_arc
    : [];

  const dossier = {
    prospect_summary: buildProspectSummary(
      meetingData,
      painPoints,
      keywords,
      existing?.prospect_summary
    ),
    narrative_arc: [...existingArc, ...newArc].slice(-8),
    current_sentiment:
      inferSentiment(prospectEntries) || existing?.current_sentiment || "Neutral",
    remaining_friction:
      inferRemainingFriction(prospectEntries, existing?.remaining_friction) ||
      "No explicit friction captured.",
    next_strategic_objective: inferNextObjective(
      inferRemainingFriction(prospectEntries, existing?.remaining_friction)
    ),
  };

  return JSON.stringify(dossier, null, 2);
}
