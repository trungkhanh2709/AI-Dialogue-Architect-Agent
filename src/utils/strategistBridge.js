function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clipText(value, max = 320) {
  const text = cleanText(value);
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function formatDateLabel(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Recent";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getNestedId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return (
      value.id ||
      value._id?.$oid ||
      value._id ||
      value.profileId ||
      value.profile_id ||
      ""
    );
  }
  return "";
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function normalizeHistoryId(history) {
  return normalizeId(
    history?.id || history?._id?.$oid || history?._id || history?.historyId
  );
}

function normalizeMessageList(list, fallbackRole) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const content = cleanText(item.content || item.text);
      if (!content) return null;
      return {
        role: cleanText(item.role || fallbackRole || "assistant") || "assistant",
        content,
      };
    })
    .filter(Boolean);
}

function collectCandidateProfileIds(artifact) {
  const candidates = [
    artifact?.brandDNA?.id,
    artifact?.brandDNA?._id,
    artifact?.brandDNA?.profileId,
    artifact?.brandDNA?.profile_id,
    artifact?.selectedProfile?.id,
    artifact?.selectedProfile?._id,
    artifact?.selectedProfile?.profileId,
    artifact?.selectedProfile?.profile_id,
    artifact?.rawResult?.profileId,
    artifact?.rawResult?.profile_id,
    artifact?.rawResult?.selectedProfileId,
    artifact?.rawResult?.selectedProfile?.id,
    artifact?.rawResult?.selectedProfile?._id,
    artifact?.rawResult?.toolCurrentQuery?.profileId,
    artifact?.rawResult?.toolCurrentQuery?.profile_id,
  ]
    .map(getNestedId)
    .map(normalizeId)
    .filter(Boolean);

  return [...new Set(candidates)];
}

function collectCandidateProfileNames(artifact) {
  const candidates = [
    artifact?.brandDNA?.nameOfBusiness,
    artifact?.brandDNA?.entity_name,
    artifact?.brandDNA?.companyName,
    artifact?.selectedProfile?.name,
    artifact?.selectedProfile?.nameOfBusiness,
    artifact?.selectedProfile?.entity_name,
    artifact?.rawResult?.profileName,
    artifact?.rawResult?.selectedProfileName,
    artifact?.rawResult?.selectedProfile?.name,
    artifact?.rawResult?.toolCurrentQuery?.profileName,
  ]
    .map(cleanText)
    .filter(Boolean);

  return [...new Set(candidates)];
}

function inferSentiment(text) {
  const sample = cleanText(text).toLowerCase();
  if (!sample) return "Neutral";
  if (
    /\b(concern|worried|skeptic|skeptical|budget|cost|price|timeline|delay|risk|not sure|unsure|hard|difficult|problem)\b/.test(
      sample
    )
  ) {
    return "Skeptical";
  }
  if (
    /\b(interested|aligned|open to|sounds good|good fit|makes sense|yes|great|helpful)\b/.test(
      sample
    )
  ) {
    return "Positive";
  }
  return "Neutral";
}

function extractKeyLines(text, limit = 4) {
  const seen = new Set();
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line) => line.length > 18)
    .filter((line) =>
      /\b(pain|problem|issue|friction|objection|budget|price|timeline|risk|concern|integration|migration|approval|roi|goal|challenge)\b/i.test(
        line
      )
    )
    .filter((line) => {
      const key = normalizeKey(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function buildNarrativeArc(architectMessages, prospectMessages) {
  const arc = [];
  const maxTurns = Math.min(Math.max(prospectMessages.length, architectMessages.length), 4);

  for (let index = 0; index < maxTurns; index += 1) {
    const prospectLine = prospectMessages[index]?.content || "";
    const architectLine = architectMessages[index]?.content || "";
    if (!prospectLine && !architectLine) continue;

    arc.push({
      stage:
        index === 0
          ? "Discovery"
          : /\b(price|budget|timeline|risk|objection)\b/i.test(prospectLine)
          ? "Objection Handling"
          : "Strategic Follow-Up",
      event: prospectLine
        ? `Prospect signal: ${clipText(prospectLine, 120)}`
        : "Prospect context carried from prior analysis.",
      outcome: architectLine
        ? `Recommended response: ${clipText(architectLine, 120)}`
        : "No recommended response captured.",
    });
  }

  return arc;
}

function buildConversationOutput(artifact) {
  const sections = [];

  if (artifact.architectMessages.length) {
    sections.push(
      [
        "Architect Chat:",
        ...artifact.architectMessages.map(
          (item, index) => `${index + 1}. ${item.content}`
        ),
      ].join("\n")
    );
  }

  if (artifact.prospectMessages.length) {
    sections.push(
      [
        "Prospect Simulation:",
        ...artifact.prospectMessages.map(
          (item, index) => `${index + 1}. ${item.content}`
        ),
      ].join("\n")
    );
  }

  return sections.join("\n\n").trim();
}

export function getProfileId(profile) {
  return normalizeId(
    profile?.id ||
      profile?._id?.$oid ||
      profile?._id ||
      profile?.profileId ||
      profile?.profile_id
  );
}

export function getProfileDisplayName(profile) {
  return pickFirstText(
    profile?.entity_name,
    profile?.nameOfBusiness,
    profile?.companyName,
    profile?.name,
    profile?.username,
    "Profile"
  );
}

export function getProfileContextSummary(profile) {
  return pickFirstText(
    profile?.strategic_context,
    profile?.typeOfBusiness,
    profile?.industry,
    profile?.target_audience_analysis,
    profile?.target_audience_summary
  );
}

export function getProfileCognitiveCloneTone(profile) {
  return pickFirstText(
    profile?.cognitive_clone_tone,
    profile?.full_report,
    profile?.fullReport,
    profile?.cognitive_dna
  );
}

export function mergeProfileIntoFormData(currentData, profile) {
  if (!profile || typeof profile !== "object") return currentData;

  return {
    ...currentData,
    profileId: getProfileId(profile),
    profileName: getProfileDisplayName(profile),
    userCompanyName:
      pickFirstText(
        profile?.entity_name,
        profile?.nameOfBusiness,
        currentData?.userCompanyName
      ) || currentData?.userCompanyName,
    userCompanyServices:
      pickFirstText(
        profile?.strategic_context,
        profile?.typeOfBusiness,
        profile?.industry,
        currentData?.userCompanyServices
      ) || currentData?.userCompanyServices,
    cognitiveCloneTone:
      getProfileCognitiveCloneTone(profile) || currentData?.cognitiveCloneTone || "",
  };
}

export function normalizeConversionArchitectArtifacts(payload) {
  const histories = Array.isArray(payload?.histories)
    ? payload.histories
    : Array.isArray(payload)
    ? payload
    : [];

  return histories
    .map((history) => {
      const parsedResult = safeParseJson(history?.result) || history?.result || {};
      const dossier = safeParseJson(parsedResult?.dossier) || parsedResult?.dossier || {};
      const architectMessages = normalizeMessageList(
        parsedResult?.architectMessages,
        "assistant"
      );
      const prospectMessages = normalizeMessageList(
        parsedResult?.prospectMessages,
        "prospect"
      );

      const artifact = {
        id: normalizeHistoryId(history),
        title: cleanText(history?.title || parsedResult?.title || "Conversion Architect File"),
        createdAt: normalizeDate(history?.createdAt || history?.updatedAt),
        rawHistory: history,
        rawResult: parsedResult,
        prospectName: pickFirstText(
          parsedResult?.prospectName,
          parsedResult?.toolCurrentQuery?.prospectName
        ),
        companyName: pickFirstText(
          parsedResult?.companyName,
          parsedResult?.toolCurrentQuery?.companyName
        ),
        companyWebsite: pickFirstText(parsedResult?.companyWebsite),
        psychReport: pickFirstText(
          dossier?.psych,
          parsedResult?.psych_analyzer,
          parsedResult?.psychAnalyzerResult
        ),
        businessReport: pickFirstText(
          dossier?.business,
          parsedResult?.business_dna,
          parsedResult?.businessDNAResult
        ),
        architectMessages,
        prospectMessages,
        brandDNA: parsedResult?.brandDNA || {},
        selectedProfile: parsedResult?.selectedProfile || {},
      };

      artifact.profileIds = collectCandidateProfileIds(artifact);
      artifact.profileNames = collectCandidateProfileNames(artifact);
      return artifact;
    })
    .filter((artifact) => artifact.id);
}

export function artifactMatchesProfile(artifact, profile) {
  const profileId = getProfileId(profile);
  const profileName = normalizeKey(getProfileDisplayName(profile));

  if (!artifact) return false;

  if (profileId && artifact.profileIds.includes(profileId)) {
    return true;
  }

  if (!profileName) return false;
  return artifact.profileNames.some((name) => normalizeKey(name) === profileName);
}

export function filterArtifactsByProfile(artifacts, profile) {
  if (!Array.isArray(artifacts)) return [];
  if (!profile) return artifacts;
  const matched = artifacts.filter((artifact) => artifactMatchesProfile(artifact, profile));
  if (matched.length) return matched;

  const hasProfileMetadata = artifacts.some(
    (artifact) => artifact?.profileIds?.length || artifact?.profileNames?.length
  );

  return hasProfileMetadata ? [] : artifacts;
}

export function getArtifactOptionLabel(artifact) {
  if (!artifact) return "Conversion Architect File";
  const prospect = pickFirstText(artifact.prospectName, artifact.companyName);
  const dateLabel = formatDateLabel(artifact.createdAt);
  return [artifact.title, prospect && prospect !== artifact.title ? prospect : "", dateLabel]
    .filter(Boolean)
    .join(" - ");
}

export function buildStrategistDataFromArtifact(artifact) {
  const psychReport = artifact?.psychReport || "";
  const businessReport = artifact?.businessReport || "";
  const conversationOutput = buildConversationOutput(artifact);
  const lastProspectMessage =
    artifact?.prospectMessages?.[artifact.prospectMessages.length - 1]?.content || "";
  const keyLines = [
    ...extractKeyLines(psychReport, 3),
    ...extractKeyLines(businessReport, 3),
  ].slice(0, 5);

  const prospectSummary = [
    artifact?.prospectName ? `Prospect: ${artifact.prospectName}.` : "",
    artifact?.companyName ? `Company: ${artifact.companyName}.` : "",
    keyLines.length ? `Key pain points: ${keyLines.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const remainingFriction = clipText(
    lastProspectMessage || keyLines[0] || "No explicit blocker captured yet.",
    180
  );

  const nextStrategicObjective =
    /\b(price|budget|cost|roi)\b/i.test(remainingFriction)
      ? "Reframe the commercial value against budget pressure and test buying criteria."
      : /\b(timeline|delay|integration|migration|implementation)\b/i.test(
          remainingFriction
        )
      ? "Reduce implementation risk and move the prospect to one realistic next step."
      : /\b(risk|legal|security|approval|compliance)\b/i.test(remainingFriction)
      ? "Address the hidden risk blocker directly and identify the approver needed."
      : "Clarify the unresolved friction and lock one commitment for the next conversation.";

  const dossier = {
    prospect_summary: prospectSummary || "Conversion Architect context imported from saved file.",
    narrative_arc: buildNarrativeArc(
      artifact?.architectMessages || [],
      artifact?.prospectMessages || []
    ),
    current_sentiment: inferSentiment(lastProspectMessage || conversationOutput),
    remaining_friction: remainingFriction,
    next_strategic_objective: nextStrategicObjective,
  };

  const analysisSections = [
    artifact?.title ? `Source File: ${artifact.title}` : "",
    artifact?.prospectName ? `Prospect: ${artifact.prospectName}` : "",
    artifact?.companyName ? `Company: ${artifact.companyName}` : "",
    keyLines.length ? `Key Signals:\n- ${keyLines.join("\n- ")}` : "",
    psychReport ? `Psych Report Summary:\n${clipText(psychReport, 900)}` : "",
    businessReport ? `Business Report Summary:\n${clipText(businessReport, 900)}` : "",
    conversationOutput ? `Chat Output:\n${clipText(conversationOutput, 1400)}` : "",
    `Recommended Focus:\n${nextStrategicObjective}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    profileId: artifact?.profileIds?.[0] || "",
    profileName: artifact?.profileNames?.[0] || "",
    conversionArchitectFileId: artifact?.id || "",
    conversionArchitectFileName: artifact?.title || "",
    psychAnalyzerResult: psychReport,
    businessDNAResult: businessReport,
    conversionArchitectDossier: JSON.stringify(dossier, null, 2),
    conversionArchitectAnalysis: analysisSections,
    conversionArchitectChatOutput: conversationOutput,
  };
}

export function mergeArtifactIntoFormData(currentData, artifact) {
  if (!artifact) return currentData;
  const strategistData = buildStrategistDataFromArtifact(artifact);

  return {
    ...currentData,
    ...strategistData,
    conversionArchitectDossier:
      strategistData.conversionArchitectDossier ||
      currentData?.conversionArchitectDossier ||
      "",
    conversionArchitectAnalysis:
      strategistData.conversionArchitectAnalysis ||
      currentData?.conversionArchitectAnalysis ||
      "",
    conversionArchitectChatOutput:
      strategistData.conversionArchitectChatOutput ||
      currentData?.conversionArchitectChatOutput ||
      "",
    meetingMessage:
      currentData?.meetingMessage || strategistData.conversionArchitectChatOutput || "",
  };
}
