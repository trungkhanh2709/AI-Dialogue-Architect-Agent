import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveDock from "../component/LiveDock";
import {
  buildConversionArchitectDossier,
  parseConversionArchitectDossier,
} from "../utils/conversionArchitectDossier";

const AGENT_DEBOUNCE_MS = 1500;
const AGENT_MIN_INTERVAL_MS = 3000;
const AGENT_USE_STREAMING = true;
const AGENT_MAX_LOG_LINES = 30;
const AGENT_MAX_LOG_CHARS = 4000;
const FAST_LOG_LINES = 8;
const FAST_LOG_CHARS = 1200;
const AGENT_CONTEXT_MAX_CHARS = 2000;

const COMPLEX_MARKERS = [
  /price|pricing|budget|roi|contract|legal|security|compliance/i,
  /timeline|deadline|integration|implementation|migration|scope/i,
  /issue|problem|risk|objection|concern|cost|discount/i,
  /\d{2,}/,
];

const GREETING_MARKERS = [
  /^(hi|hello|hey|yo)\b/i,
  /\b(good (morning|afternoon|evening)|nice to meet)\b/i,
  /^(chào|xin chào|hello|hi)\b/i,
];

const THANKS_MARKERS = [
  /\b(thanks|thank you|thank u|thx)\b/i,
  /\b(cảm ơn|cam on|cám ơn)\b/i,
];

const META_OUTPUT_MARKERS = [
  /final output protocol/i,
  /script & tonality/i,
  /directives analysis/i,
  /influence style/i,
  /analyze the battlefield/i,
  /stage\s*\d+/i,
  /tonalities?/i,
  /primary influence/i,
  /go\s*\/\s*no-go/i,
];

const META_LINE_RE =
  /^(script|stage|directive|pre-engagement|final output|analysis|tonality|influence style)\b/i;
const META_INLINE_RE =
  /(pre-engagement|final output|directive|tonality|influence style|go\s*\/\s*no-go)/i;

const isSystemCaptionText = (speaker, text) => {
  const t = `${speaker || ""} ${text || ""}`.toLowerCase();
  if (
    t.includes("live captions have been turned off") ||
    t.includes("live captions have been turned on") ||
    t.includes("captions have been turned off") ||
    t.includes("captions have been turned on")
  ) {
    return true;
  }
  if (
    t.includes("open caption settings") ||
    t.includes("caption settings") ||
    t.includes("font size") ||
    t.includes("font color") ||
    t.includes("format_size")
  ) {
    return true;
  }
  if (
    t.includes("your mic is off") ||
    t.includes("mic is off") ||
    t.includes("microphone is off") ||
    t.includes("mic is muted") ||
    t.includes("microphone is muted") ||
    t.includes("you're muted") ||
    t.includes("you are muted") ||
    t.includes("turn on microphone") ||
    t.includes("turn on mic") ||
    t.includes("unmute") ||
    t.includes("camera is off") ||
    t.includes("your camera is off") ||
    t.includes("turn on camera") ||
    t.includes("đã tắt mic") ||
    t.includes("đã tắt micro") ||
    t.includes("mic đã tắt") ||
    t.includes("micro đã tắt") ||
    t.includes("microphone đã tắt") ||
    t.includes("bạn đang tắt mic") ||
    t.includes("bạn đang tắt tiếng") ||
    t.includes("mic bị tắt") ||
    t.includes("micro bị tắt") ||
    t.includes("camera đã tắt") ||
    t.includes("đã tắt camera") ||
    t.includes("bật mic") ||
    t.includes("bật micro") ||
    t.includes("bật camera")
  ) {
    return true;
  }
  return false;
};

export default function MeetingPage({
  meetingData,
  onBack,
  cookieUserName,
}) {
  const SELF_GENERIC_LABELS = new Set([
    "you",
    "ban",
    "toi",
    "me",
    "myself",
    "yourself",
    "vous",
    "tu",
    "usted",
    "ustedes",
    "du",
    "sie",
    "voce",
    "você",
    "voces",
    "vocês",
    "anda",
    "kamu",
    "ni",
    "你",
    "您",
    "妳",
    "anata",
    "あなた",
    "kimi",
    "君",
    "neo",
    "너",
    "dangsin",
    "당신",
    "vy",
    "вы",
    "ty",
    "ты",
    "sen",
    "siz",
  ]);
  const UNKNOWN_SPEAKER_LABELS = new Set([
    "speaker",
    "participant",
    "unknown",
  ]);

  const decodedCookieEmail = useMemo(() => {
    if (!cookieUserName) return "";
    try {
      return decodeURIComponent(cookieUserName);
    } catch {
      return cookieUserName;
    }
  }, [cookieUserName]);

  const [meetingLog, setMeetingLog] = useState([]);
  const meetingLogRef = useRef([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [captionStatus, setCaptionStatus] = useState(null);
  const [lastRealTranscriptAt, setLastRealTranscriptAt] = useState(null);
  const [, setLastTranscriptAt] = useState(null);
  const [lastCaptionDetectedAt, setLastCaptionDetectedAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [detectedLanguage, setDetectedLanguage] = useState("English");
  const [selfDisplayName, setSelfDisplayName] = useState("");
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [autoCollapseEnabled] = useState(
    localStorage.getItem("ada_autoCollapse") !== "false"
  );
  const reqIdRef = useRef(0);
  const transcriptIdRef = useRef(null);
  const messageIdRef = useRef(0);
  const pendingUtteranceRef = useRef("");
  const pendingSpeakerRef = useRef("");
  const pendingTimerRef = useRef(null);
  const lastAgentRequestAtRef = useRef(0);
  const agentInFlightRef = useRef(false);
  const activeAgentRequestIdRef = useRef(null);
  const recentTranscriptKeysRef = useRef(new Map());
  const recentFillerKeysRef = useRef(new Map());
  const recentQueuedAgentKeysRef = useRef(new Map());
  const recentAgentSendKeysRef = useRef(new Map());
  const runtimeMessageHandlerRef = useRef(null);
  const nextId = () => ++messageIdRef.current;

  const rememberRecentKey = (storeRef, key, ttl = 4000) => {
    const now = Date.now();
    const store = storeRef.current;
    for (const [k, ts] of store.entries()) {
      if (now - ts > ttl) store.delete(k);
    }
    if (store.has(key)) return true;
    store.set(key, now);
    return false;
  };

  const makeStableMessageKey = (_speaker, text) => {
    const stableText = String(text || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    return stableText;
  };

  const trimMeetingLog = (log, fastMode = false) => {
    if (!Array.isArray(log)) return log;
    const maxLines = fastMode ? FAST_LOG_LINES : AGENT_MAX_LOG_LINES;
    const maxChars = fastMode ? FAST_LOG_CHARS : AGENT_MAX_LOG_CHARS;
    const lines = log.slice(-maxLines);
    const joined = lines.join("\n");
    if (joined.length <= maxChars) return lines;
    const trimmed = joined.slice(-maxChars);
    return trimmed.split("\n");
  };

  const trimContext = (value, maxChars = AGENT_CONTEXT_MAX_CHARS) => {
    if (!value) return value;
    const text = String(value);
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  };

  const readStoredCognitiveCloneTone = () => {
    try {
      return localStorage.getItem("bm.persona_profile") || "";
    } catch {
      return "";
    }
  };

  const buildStrategicContext = () => {
    const parts = [
      meetingData?.profileName ? `Selected Profile: ${meetingData.profileName}` : "",
      meetingData?.conversionArchitectFileName
        ? `Conversion Architect File: ${meetingData.conversionArchitectFileName}`
        : "",
      meetingData?.userCompanyName
        ? `Company: ${meetingData.userCompanyName}`
        : "",
      meetingData?.userCompanyServices
        ? `Services: ${meetingData.userCompanyServices}`
        : "",
      meetingData?.meetingGoal ? `Meeting Goal: ${meetingData.meetingGoal}` : "",
      meetingData?.meetingNote ? `Strategic Notes: ${meetingData.meetingNote}` : "",
      meetingData?.meetingEmail ? `Email Thread: ${meetingData.meetingEmail}` : "",
      meetingData?.meetingMessage
        ? `Prior Message History: ${meetingData.meetingMessage}`
        : "",
      meetingData?.conversionArchitectAnalysis
        ? `Conversion Architect Analysis: ${meetingData.conversionArchitectAnalysis}`
        : "",
      meetingData?.conversionArchitectChatOutput
        ? `Conversion Architect Chat Output: ${meetingData.conversionArchitectChatOutput}`
        : "",
      meetingData?.businessDNAResult
        ? `Business DNA: ${meetingData.businessDNAResult}`
        : "",
      meetingData?.psychAnalyzerResult
        ? `Psych Analysis: ${meetingData.psychAnalyzerResult}`
        : "",
    ].filter(Boolean);

    return parts.join("\n\n");
  };

  const buildAgentMeetingData = () => ({
    ...meetingData,
    profileId: meetingData?.profileId || "",
    profileName: meetingData?.profileName || "",
    conversionArchitectFileId: meetingData?.conversionArchitectFileId || "",
    conversionArchitectFileName: meetingData?.conversionArchitectFileName || "",
    businessDNAResult: trimContext(meetingData?.businessDNAResult),
    psychAnalyzerResult: trimContext(meetingData?.psychAnalyzerResult),
    conversionArchitectAnalysis: trimContext(
      meetingData?.conversionArchitectAnalysis,
      3500
    ),
    conversionArchitectChatOutput: trimContext(
      meetingData?.conversionArchitectChatOutput,
      3500
    ),
    meetingNote: trimContext(meetingData?.meetingNote),
    meetingMessage: trimContext(meetingData?.meetingMessage),
    meetingEmail: trimContext(meetingData?.meetingEmail),
    cognitiveCloneTone: trimContext(
      meetingData?.cognitiveCloneTone || readStoredCognitiveCloneTone(),
      2500
    ),
    entity_name: meetingData?.userName || meetingData?.userNameAndRole || inferredSelfName,
    strategic_context: trimContext(buildStrategicContext(), 3500),
    cognitive_clone_tone: trimContext(
      meetingData?.cognitiveCloneTone || readStoredCognitiveCloneTone(),
      2500
    ),
    conversionArchitectDossier: effectiveDossierText,
    conversion_architect_dossier: effectiveDossierText,
    conversion_architect_dossier_json:
      parseConversionArchitectDossier(effectiveDossierText),
    meeting_goal: trimContext(meetingData?.meetingGoal),
    strategic_directive: trimContext(
      meetingData?.meetingGoal || meetingData?.meetingNote
    ),
  });

  const removeThinkingMessage = (requestId) => {
    setChatMessages((prev) =>
      prev.filter(
        (msg) => !(msg.isThinking && msg.requestId === requestId)
      )
    );
  };

  const requestThinkingFiller = (requestId, newMessage, log) => {
    const overrideCommand = newMessage?.isOverride
      ? String(newMessage?.text || "").trim()
      : "";
    chrome.runtime.sendMessage(
      {
        type: "SEND_FILLER_REQUEST",
        payload: {
          meetingData: buildAgentMeetingData(),
          log,
          requestId,
          finalizedMessage: newMessage,
          overrideCommand,
        },
      },
      () => {}
    );
  };

  const markAgentDone = (requestId) => {
    if (activeAgentRequestIdRef.current !== requestId) return;
    agentInFlightRef.current = false;
    lastAgentRequestAtRef.current = Date.now();
    if ((pendingUtteranceRef.current || "").trim()) {
      pendingTimerRef.current = setTimeout(
        flushPendingAgentRequest,
        AGENT_DEBOUNCE_MS
      );
    }
  };

  useEffect(() => {
    setMeetingLog([]);
    setChatMessages([]);
    setCaptionStatus(null);
    setLastTranscriptAt(null);
    transcriptIdRef.current = null;
  }, [meetingData?._id, meetingData?.id]);

  useEffect(() => {
    meetingLogRef.current = meetingLog;
  }, [meetingLog]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 3000);
    return () => clearInterval(interval);
  }, []);

  const normalizeSpeaker = (value) => {
    let normalized = String(value || "").trim().toLowerCase();
    try {
      normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    } catch {}
    return normalized.replace(/[^a-z0-9]+/g, "");
  };

  const prettifyIdentity = (value) =>
    String(value || "")
      .trim()
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const looksLikeHumanName = (value) => {
    const text = String(value || "").trim();
    if (!text || text.length < 3 || text.length > 60) return false;
    const normalized = normalizeSpeaker(text);
    if (!normalized) return false;
    if (SELF_GENERIC_LABELS.has(normalized)) return false;
    if (UNKNOWN_SPEAKER_LABELS.has(normalized)) return false;
    if (/\d/.test(text) || /[?.!,:;]$/.test(text)) return false;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 5) return false;
    return words.every((word) => word.length >= 2);
  };

  const emailLocalPart = useMemo(() => {
    if (!decodedCookieEmail) return "";
    return decodedCookieEmail.split("@")[0] || "";
  }, [decodedCookieEmail]);

  const inferredSelfName = useMemo(() => {
    const explicitName =
      meetingData?.userName && !String(meetingData.userName).includes("@")
        ? String(meetingData.userName).trim()
        : "";
    if (selfDisplayName) return selfDisplayName;
    if (explicitName) return explicitName;
    if (emailLocalPart) return prettifyIdentity(emailLocalPart);
    return "You";
  }, [meetingData?.userName, selfDisplayName, emailLocalPart]);

  const effectiveDossierText = useMemo(() => {
    const existingText =
      meetingData?.conversionArchitectDossier ||
      meetingData?.conversion_architect_dossier ||
      "";

    if (String(existingText || "").trim()) {
      return trimContext(existingText, 5000);
    }

    const historicalTranscript =
      meetingData?.meetingTranscript || meetingData?.meeting_transcript || "";

    if (!String(historicalTranscript || "").trim()) {
      return "";
    }

    return trimContext(
      buildConversionArchitectDossier({
        meetingData,
        transcriptText: historicalTranscript,
        existingDossierText: "",
        selfNames: [inferredSelfName],
      }),
      5000
    );
  }, [inferredSelfName, meetingData]);

  const mySpeakerAliases = useMemo(() => {
    const aliases = new Set();
    if (meetingData?.userName) {
      aliases.add(normalizeSpeaker(meetingData.userName));
    }
    if (decodedCookieEmail) {
      aliases.add(normalizeSpeaker(decodedCookieEmail));
      if (emailLocalPart) aliases.add(normalizeSpeaker(emailLocalPart));
    }
    if (selfDisplayName) aliases.add(normalizeSpeaker(selfDisplayName));
    if (inferredSelfName) aliases.add(normalizeSpeaker(inferredSelfName));
    return new Set([...aliases].filter(Boolean));
  }, [
    meetingData?.userName,
    decodedCookieEmail,
    emailLocalPart,
    selfDisplayName,
    inferredSelfName,
  ]);

  useEffect(() => {
    const directNameSelectors = [
      '[data-self-name]',
      '[aria-label*="you" i]',
      '[aria-label*="vous" i]',
      '[aria-label*="usted" i]',
      '[aria-label*="du" i]',
      '[aria-label*="você" i]',
      '[aria-label*="你" i]',
      '[aria-label*="あなた" i]',
      '[aria-label*="너" i]',
      '[aria-label*="вы" i]',
      '[aria-label*="bạn" i]',
    ];

    const extractSelfDisplayNameFromDom = () => {
      const visibleTextMatches = new Set();
      const candidateNames = [
        meetingData?.userName,
        inferredSelfName,
        emailLocalPart,
        prettifyIdentity(emailLocalPart),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean);

      for (const selector of directNameSelectors) {
        try {
          const nodes = document.querySelectorAll(selector);
          for (const node of nodes) {
            const text = String(node.textContent || "").trim();
            if (text && !SELF_GENERIC_LABELS.has(normalizeSpeaker(text))) {
              visibleTextMatches.add(text);
            }
            let parent = node;
            for (let i = 0; i < 4 && parent; i += 1) {
              const nearbyTexts = Array.from(
                parent.querySelectorAll?.("span, div") || []
              )
                .map((el) => String(el.textContent || "").trim())
                .filter((candidate) => looksLikeHumanName(candidate));
              nearbyTexts.forEach((candidate) => visibleTextMatches.add(candidate));
              parent = parent.parentElement;
            }
          }
        } catch {}
      }

      try {
        const nodes = document.querySelectorAll("span, div");
        for (const node of nodes) {
          const text = String(node.textContent || "").trim();
          if (!text || text.length > 80) continue;
          if (text.includes("\n")) continue;
          const style = window.getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") continue;
          const rect = node.getBoundingClientRect?.();
          if (!rect || rect.width === 0 || rect.height === 0) continue;
          const normalizedText = normalizeSpeaker(text);
          if (!normalizedText) continue;
          if (
            candidateNames.some(
              (candidate) => normalizeSpeaker(candidate) === normalizedText
            )
          ) {
            visibleTextMatches.add(text);
          }
          const isBottomLeftCandidate =
            rect.left < window.innerWidth * 0.28 &&
            rect.top > window.innerHeight * 0.55 &&
            rect.width < window.innerWidth * 0.35;
          if (isBottomLeftCandidate && looksLikeHumanName(text)) {
            visibleTextMatches.add(text);
          }
        }
      } catch {}

      const [firstMatch] = [...visibleTextMatches];
      if (firstMatch) {
        setSelfDisplayName((prev) => prev || firstMatch);
      }
    };

    extractSelfDisplayNameFromDom();
    const interval = setInterval(extractSelfDisplayNameFromDom, 3000);
    return () => clearInterval(interval);
  }, [meetingData?.userName, inferredSelfName, emailLocalPart]);

  const resolveSpeaker = (rawSpeaker) => {
    const raw = String(rawSpeaker || "").trim() || "Speaker";
    const normalizedRaw = normalizeSpeaker(raw);
    const resolvedSelf = inferredSelfName || raw;

    if (SELF_GENERIC_LABELS.has(normalizedRaw)) {
      return {
        rawSpeaker: raw,
        speakerLabel: resolvedSelf,
        isSelf: true,
        isUnknown: false,
      };
    }

    if (UNKNOWN_SPEAKER_LABELS.has(normalizedRaw)) {
      return {
        rawSpeaker: raw,
        speakerLabel: "Unknown Speaker",
        isSelf: false,
        isUnknown: true,
      };
    }

    if (mySpeakerAliases.has(normalizedRaw)) {
      return {
        rawSpeaker: raw,
        speakerLabel: resolvedSelf,
        isSelf: true,
        isUnknown: false,
      };
    }

    return {
      rawSpeaker: raw,
      speakerLabel: raw,
      isSelf: false,
      isUnknown: false,
    };
  };

  const isSpeakerOnlyText = (speaker, text) => {
    if (!speaker || !text) return false;
    const s = normalizeSpeaker(speaker);
    const t = normalizeSpeaker(text);
    return s && t && s === t;
  };

  const detectLanguage = (text) => {
    if (!text || typeof text !== "string") return "English";
    const vietnameseChars =
      /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
    if (vietnameseChars.test(text)) return "Vietnamese";
    if (/[a-zA-Z]/.test(text)) return "English";
    return "English";
  };

  const updateDetectedLanguage = (text) => {
    const detected = detectLanguage(text);
    if (detected) setDetectedLanguage(detected);
  };

  const isFastUtterance = (text) => {
    const cleaned = String(text || "").trim();
    if (!cleaned) return false;
    if (COMPLEX_MARKERS.some((r) => r.test(cleaned))) return false;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length <= 4 && cleaned.length <= 28) return true;
    if (
      (GREETING_MARKERS.some((r) => r.test(cleaned)) ||
        THANKS_MARKERS.some((r) => r.test(cleaned))) &&
      words.length <= 8
    ) {
      return true;
    }
    return false;
  };

  const buildFastLocalReply = (text, language) => {
    const cleaned = String(text || "").trim();
    if (!cleaned) return null;
    const isGreeting = GREETING_MARKERS.some((r) => r.test(cleaned));
    const isThanks = THANKS_MARKERS.some((r) => r.test(cleaned));
    if (!isGreeting && !isThanks) return null;

    if (language === "Vietnamese") {
      if (isGreeting) {
        return "Chào bạn! Rất vui được gặp. Hôm nay bạn thế nào?";
      }
      if (isThanks) {
        return "Rất vui được hỗ trợ. Bạn muốn mình giúp gì tiếp?";
      }
    }
    if (isGreeting) {
      return "Hi! Great to see you. How are you today?";
    }
    if (isThanks) {
      return "Happy to help. What would you like to cover next?";
    }
    return null;
  };

  const sanitizeAgentResponse = (text) => {
    let t = String(text || "");
    if (!t) return "";

    t = t.replace(/\\n/g, "\n").replace(/\\t/g, " ").replace(/\\"/g, '"');
    t = t.replace(/\r\n/g, "\n");
    t = t.trim();
    if (!t) return t;

    // Drop code fences.
    t = t.replace(/```[\s\S]*?```/g, " ").trim();

    // Prefer content after "Script:" if present.
    const scriptMatch = t.match(/(^|\n)\s*script\s*:\s*/i);
    if (scriptMatch && scriptMatch.index != null) {
      t = t.slice(scriptMatch.index);
      t = t.replace(/(^|\n)\s*script\s*:\s*/i, "").trim();
    }

    // Remove meta/analysis lines.
    const rawLines = t
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const metaDetected =
      META_OUTPUT_MARKERS.some((re) => re.test(t)) ||
      /directive|protocol|tonality|influence style|stage\s*\d+/i.test(t);

    const stripMetaPrefix = (line) => {
      let cleaned = line;
      META_OUTPUT_MARKERS.forEach((re) => {
        cleaned = cleaned.replace(re, "").trim();
      });
      cleaned = cleaned.replace(/^[:\-–—]+/, "").trim();
      return cleaned;
    };

    const lines = metaDetected
      ? rawLines
          .map((line) => {
            if (META_OUTPUT_MARKERS.some((re) => re.test(line))) {
              return stripMetaPrefix(line);
            }
            return line;
          })
          .filter(
            (line) =>
              line &&
              !META_OUTPUT_MARKERS.some((re) => re.test(line)) &&
              !META_LINE_RE.test(line) &&
              !META_INLINE_RE.test(line)
          )
      : rawLines;

    const pickFromMatches = (matches) => {
      if (!matches || !matches.length) return "";
      return matches
        .map((m) => (m[1] || "").trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");
    };

    if (metaDetected) {
      const backtickMatches = Array.from(t.matchAll(/`([^`]{10,})`/gs));
      const quoteMatches = Array.from(
        t.matchAll(/["“”]([^"“”]{10,})["“”]/gs)
      );
      const parenMatches = Array.from(t.matchAll(/\(([^)]{10,})\)/gs));
      let candidate =
        pickFromMatches(backtickMatches) ||
        pickFromMatches(quoteMatches) ||
        pickFromMatches(parenMatches);
      if (!candidate) {
        const spokenLines = lines.filter(
          (line) =>
            (line.startsWith("(") || /[?!.]$/.test(line)) &&
            !META_LINE_RE.test(line) &&
            !META_INLINE_RE.test(line)
        );
        candidate = spokenLines.slice(0, 2).join(" ");
      }
      if (!candidate) {
        const questionLines = rawLines
          .filter(
            (line) =>
              (/\?$/.test(line) ||
                /can you|could you|would you|what|how|why/i.test(line)) &&
              !META_LINE_RE.test(line) &&
              !META_INLINE_RE.test(line)
          )
          .slice(0, 2);
        candidate = questionLines.join(" ");
      }
      if (!candidate) {
        const sentencePool = t
          .replace(/\n+/g, " ")
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .filter(
            (line) =>
              !META_LINE_RE.test(line) && !META_INLINE_RE.test(line)
          );
        const questionSentence = sentencePool.find((s) => s.includes("?"));
        candidate = questionSentence || sentencePool.slice(-1)[0] || "";
      }
      if (
        candidate &&
        (META_LINE_RE.test(candidate) || META_INLINE_RE.test(candidate))
      ) {
        candidate = "";
      }
      if (!candidate) {
        candidate = "What would you like to focus on next?";
      }
      t = candidate || lines.join(" ");
    } else {
      t = lines.join(" ");
    }

    // Strip markdown emphasis markers.
    t = t.replace(/[*_`]+/g, "");
    t = t.replace(/\s+/g, " ").trim();

    // If still long, keep only the first 2 sentences.
    if (t.length > 350) {
      const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
      t = sentences.slice(0, 2).join(" ");
    }

    if (t.length > 500) {
      t = `${t.slice(0, 500).replace(/\s+\S*$/, "")}...`;
    }

    /*
    if (t.length > 500) {
      t = `${t.slice(0, 500).replace(/\s+\S*$/, "")}…`;
    }

    */

    return t.trim();
  };

  const formatAgentError = (err) => {
    if (!err) return "Agent is unable to respond";
    const raw = typeof err === "string" ? err : JSON.stringify(err, null, 0);
    const trimmed = raw.length > 200 ? `${raw.slice(0, 200)}...` : raw;
    return `Agent is unable to respond (${trimmed})`;
  };

  const saveOrUpdateMeeting = (logData) => {
    const autoSaveEnabled = localStorage.getItem("autoSaveEnabled") === "true";
    if (!autoSaveEnabled) return;

    const transcriptText = Array.isArray(logData)
      ? logData.join("\n")
      : meetingLog.join("\n");

    if (!transcriptText || transcriptText.trim().length === 0) return;

    const meetingId = meetingData._id || meetingData.id;
    if (!meetingId) return;

    chrome.runtime.sendMessage(
      {
        type: "SAVE_MEETING_TRANSCRIPT",
        payload: {
          email: decodedCookieEmail,
          meetingId,
          transcriptText,
          transcriptId: transcriptIdRef.current,
        },
      },
      (res) => {
        const tIdFromBE = res?.data?.transcript_id;
        if (tIdFromBE && !transcriptIdRef.current) {
          transcriptIdRef.current = tIdFromBE;
        }
      }
    );
  };

  const buildMeetingPreparePayload = (logData, dossierText) => {
    const transcriptText = Array.isArray(logData)
      ? logData.join("\n")
      : String(logData || "");

    return {
      blockName: meetingData?.title || meetingData?.blockName || "Untitled Meeting",
      profileId: meetingData?.profileId || "",
      profileName: meetingData?.profileName || "",
      userNameAndRole: meetingData?.userNameAndRole || meetingData?.userName || "",
      userCompanyName: meetingData?.userCompanyName || "",
      userCompanyServices: meetingData?.userCompanyServices || "",
      userCompanyWebsite: meetingData?.userCompanyWebsite || "",
      userKeyCompanyUrls: Array.isArray(meetingData?.userKeyCompanyUrls)
        ? meetingData.userKeyCompanyUrls
        : [],
      prospectName: meetingData?.prospectName || "",
      customerCompanyName: meetingData?.customerCompanyName || "",
      customerCompanyServices: meetingData?.customerCompanyServices || "",
      prospectCompanyWebsite: meetingData?.prospectCompanyWebsite || "",
      meetingGoal: meetingData?.meetingGoal || "",
      meetingEmail: meetingData?.meetingEmail || "",
      meetingMessage: meetingData?.meetingMessage || "",
      meetingNote: meetingData?.meetingNote || "",
      cognitiveCloneTone:
        meetingData?.cognitiveCloneTone || readStoredCognitiveCloneTone(),
      agentModelKey: meetingData?.agentModelKey || "groq",
      agentModelLabel: meetingData?.agentModelLabel || "",
      meetingStart: meetingData?.meetingStart || "",
      meetingDuration: meetingData?.meetingDuration || "15",
      meetingEnd: meetingData?.meetingEnd || "",
      meetingLink: meetingData?.meetingLink || "",
      eventId: meetingData?.eventId || "",
      guestEmail: meetingData?.guestEmail || "",
      createdAt: meetingData?.createdAt || new Date().toISOString(),
      psychBackground: meetingData?.psychBackground || "",
      psychUrls: Array.isArray(meetingData?.psychUrls) ? meetingData.psychUrls : [],
      psychLanguage: meetingData?.psychLanguage || "English",
      psychAnalyzerResult: meetingData?.psychAnalyzerResult || "",
      businessDNAResult: meetingData?.businessDNAResult || "",
      conversionArchitectFileId: meetingData?.conversionArchitectFileId || "",
      conversionArchitectFileName: meetingData?.conversionArchitectFileName || "",
      conversionArchitectDossier: dossierText || effectiveDossierText || "",
      conversion_architect_dossier: dossierText || effectiveDossierText || "",
      conversionArchitectAnalysis: meetingData?.conversionArchitectAnalysis || "",
      conversionArchitectChatOutput:
        meetingData?.conversionArchitectChatOutput || "",
      meeting_transcript: transcriptText,
      designatedTime: meetingData?.designatedTime || "",
    };
  };

  const createMeetingBlock = (logData, dossierText) => {
    const newBlockPayload = buildMeetingPreparePayload(logData, dossierText);

    chrome.runtime.sendMessage(
      {
        type: "CREATE_MEETING_PREPARE",
        payload: { email: decodedCookieEmail, payload: newBlockPayload },
      },
      () => {}
    );
  };

  const persistConversionArchitectDossier = (logData) => {
    const transcriptText = Array.isArray(logData)
      ? logData.join("\n")
      : String(logData || "");
    const dossierText = buildConversionArchitectDossier({
      meetingData,
      transcriptText,
      existingDossierText: effectiveDossierText,
      selfNames: [inferredSelfName],
    });

    const meetingId = meetingData._id || meetingData.id;
    if (meetingId) {
      chrome.runtime.sendMessage(
        {
          type: "UPDATE_MEETING_PREPARE",
          payload: {
            email: decodedCookieEmail,
            meetingId,
            payload: buildMeetingPreparePayload(logData, dossierText),
          },
        },
        () => {}
      );
      return;
    }

    createMeetingBlock(logData, dossierText);
  };

  const finalizeAndClose = () => {
    localStorage.setItem("autoSaveEnabled", "true");
    const meetingId = meetingData._id || meetingData.id;
    if (meetingId) {
      saveOrUpdateMeeting(meetingLogRef.current);
    }
    persistConversionArchitectDossier(meetingLogRef.current);
    onBack();
  };

  const sendMessageToAgent = (newMessage, log) => {
    const sendKey = makeStableMessageKey(newMessage?.speaker, newMessage?.text);
    if (rememberRecentKey(recentAgentSendKeysRef, sendKey, 2500)) {
      return Promise.resolve({ ok: true, skipped: true });
    }
    const overrideCommand = newMessage?.isOverride
      ? String(newMessage?.text || "").trim()
      : "";

    const requestId = ++reqIdRef.current;
    const tempMsg = {
      id: nextId(),
      speaker: "Agent",
      text: "",
      isAgent: true,
      isTemp: true,
      requestId,
    };

    setChatMessages((prev) => [...prev, tempMsg]);
    requestThinkingFiller(requestId, newMessage, log);

    const inferredLanguage = detectLanguage(newMessage?.text || "");
    const responseLanguage =
      inferredLanguage === "Vietnamese" || detectedLanguage === "Vietnamese"
        ? "Vietnamese"
        : "English";
    const fastMode = isFastUtterance(newMessage?.text || "");

    const getTimerFromBG = () =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
          resolve({
            minutes: Number(res?.minutes || 0),
            seconds: Number(res?.seconds || 0),
          });
        });
      });

    return new Promise((resolve, reject) => {
      const run = async () => {
        const trimmedLog = trimMeetingLog(log, fastMode);
        if (AGENT_USE_STREAMING) {
          chrome.runtime.sendMessage(
            {
              type: "SEND_MESSAGE_TO_AGENT_STREAM",
              payload: {
                meetingData: {
                  ...buildAgentMeetingData(),
                  responseLanguage,
                  responseStyle: fastMode ? "brief" : "normal",
                  responseComplexity: fastMode ? "low" : "normal",
                  latencyHint: fastMode ? "fast" : "normal",
                },
                chatHistory: [],
                log: trimmedLog,
                requestId,
                finalizedMessage: newMessage,
                overrideCommand,
              },
            },
            (res) => {
              if (chrome.runtime.lastError) {
                removeThinkingMessage(requestId);
                reject(chrome.runtime.lastError);
                return;
              }
              if (res?.error || res?.ok === false) {
                removeThinkingMessage(requestId);
                reject(res?.error || "Agent error");
                return;
              }
              resolve(res);
            }
          );
          return;
        }

        const timerNow = await getTimerFromBG();
        chrome.runtime.sendMessage(
          {
            type: "SEND_MESSAGE_TO_AGENT",
            payload: {
              meetingData: {
                ...buildAgentMeetingData(),
                responseLanguage,
                responseStyle: fastMode ? "brief" : "normal",
                responseComplexity: fastMode ? "low" : "normal",
                latencyHint: fastMode ? "fast" : "normal",
              },
              chatHistory: [],
              log: trimmedLog,
              requestId,
              finalizedMessage: newMessage,
              uiTimer: timerNow,
              overrideCommand,
            },
          },
          (res) => {
            if (chrome.runtime.lastError) {
              removeThinkingMessage(requestId);
              setChatMessages((prev) =>
                prev.map((msg) =>
                  msg.isTemp && msg.isAgent && msg.requestId === requestId
                    ? {
                        ...msg,
                        text: formatAgentError(chrome.runtime.lastError),
                        isTemp: false,
                      }
                    : msg
                )
              );
              reject(chrome.runtime.lastError);
              return;
            }

            if (res?.error || res?.ok === false) {
              removeThinkingMessage(requestId);
              setChatMessages((prev) =>
                prev.map((msg) =>
                  msg.isTemp && msg.isAgent && msg.requestId === requestId
                    ? {
                        ...msg,
                        text: formatAgentError(res?.error || "Agent error"),
                        isTemp: false,
                      }
                    : msg
                )
              );
              reject(res?.error || "Agent error");
              return;
            }

            const content =
              res?.data?.content ??
              res?.data?.data?.content ??
              res?.data?.text ??
              "";
            const cleanedContent = sanitizeAgentResponse(String(content || ""));

            setChatMessages((prev) =>
              prev.map((msg) =>
                msg.isAgent && msg.isTemp && msg.requestId === requestId
                  ? {
                      ...msg,
                      text: cleanedContent.trim()
                        ? cleanedContent
                        : "Agent returned empty content",
                      isTemp: false,
                    }
                  : msg
              )
            );

            removeThinkingMessage(requestId);
            updateDetectedLanguage(cleanedContent || String(content || ""));
            resolve(res);
          }
        );
      };

      run().catch((error) => {
        removeThinkingMessage(requestId);
        reject(error);
      });
    });
  };

  const handleManualAsk = (text) => {
    const msg = {
      id: nextId(),
      speaker: inferredSelfName,
      speakerLabel: inferredSelfName,
      text,
      isAgent: false,
    };
    setChatMessages((prev) => [...prev, msg]);
    sendMessageToAgent(
      { speaker: "You", text, isOverride: true },
      meetingLogRef.current
    );
  };

  const flushPendingAgentRequest = () => {
    const text = (pendingUtteranceRef.current || "").trim();
    if (!text) return;
    const speaker = pendingSpeakerRef.current || "Speaker";
    const now = Date.now();
    const sinceLast = now - lastAgentRequestAtRef.current;

    if (agentInFlightRef.current) {
      pendingTimerRef.current = setTimeout(
        flushPendingAgentRequest,
        AGENT_DEBOUNCE_MS
      );
      return;
    }

    if (sinceLast < AGENT_MIN_INTERVAL_MS) {
      const delay = Math.max(AGENT_MIN_INTERVAL_MS - sinceLast, 500);
      pendingTimerRef.current = setTimeout(flushPendingAgentRequest, delay);
      return;
    }

    pendingUtteranceRef.current = "";
    pendingSpeakerRef.current = "";

    const inferredLanguage = detectLanguage(text);
    const responseLanguage =
      inferredLanguage === "Vietnamese" || detectedLanguage === "Vietnamese"
        ? "Vietnamese"
        : "English";
    const fastLocalReply = isFastUtterance(text)
      ? buildFastLocalReply(text, responseLanguage)
      : null;

    if (fastLocalReply) {
      const requestId = ++reqIdRef.current;
      const replyMsg = {
        id: nextId(),
        speaker: "Agent",
        text: fastLocalReply,
        isAgent: true,
        isTemp: false,
        requestId,
      };
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev.filter(
            (msg) => !(msg.isThinking && msg.requestId === requestId)
          ),
          replyMsg,
        ]);
        updateDetectedLanguage(fastLocalReply);
      }, 250);

      lastAgentRequestAtRef.current = Date.now();
      return;
    }

    agentInFlightRef.current = true;

    const requestPromise = sendMessageToAgent(
      { speaker, text },
      meetingLogRef.current
    );
    const requestId = reqIdRef.current;
    activeAgentRequestIdRef.current = requestId;

    requestPromise
      .catch(() => {
        markAgentDone(requestId);
      })
      .finally(() => {
        if (!AGENT_USE_STREAMING) {
          markAgentDone(requestId);
        }
      });
  };

  const queueAgentRequest = (speaker, text) => {
    const cleaned = String(text || "").trim();
    if (!cleaned) return;

    const queuedKey = makeStableMessageKey(speaker, cleaned);
    if (rememberRecentKey(recentQueuedAgentKeysRef, queuedKey, 2500)) {
      return;
    }

    if (
      pendingSpeakerRef.current &&
      pendingSpeakerRef.current !== speaker
    ) {
      flushPendingAgentRequest();
    }

    pendingSpeakerRef.current = speaker;
    const prev = pendingUtteranceRef.current || "";
    pendingUtteranceRef.current = `${prev} ${cleaned}`.trim();

    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
    }
    pendingTimerRef.current = setTimeout(
      flushPendingAgentRequest,
      AGENT_DEBOUNCE_MS
    );
  };

  runtimeMessageHandlerRef.current = (message) => {
      if (message.type === "SESSION_EXPIRED") {
        return;
      }

      if (message.type === "AGENT_STREAM_CHUNK") {
        const { delta, requestId } = message.payload || {};
        if (!delta) return;
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.isAgent && msg.isTemp && msg.requestId === requestId
              ? { ...msg, text: (msg.text || "") + delta }
              : msg
          )
        );
        return;
      }

      if (message.type === "AGENT_STREAM_DONE") {
        const { requestId } = message.payload || {};
        let finalText = "";
        setChatMessages((prev) =>
          prev.map((msg) => {
            if (msg.isAgent && msg.isTemp && msg.requestId === requestId) {
              const cleaned = sanitizeAgentResponse(msg.text || "");
              finalText = cleaned || msg.text || "";
              return {
                ...msg,
                text: cleaned || msg.text || "",
                isTemp: false,
              };
            }
            return msg;
          })
        );
        removeThinkingMessage(requestId);
        markAgentDone(requestId);
        if (finalText) updateDetectedLanguage(finalText);
        return;
      }

      if (message.type === "AGENT_STREAM_ERROR") {
        const { error, requestId } = message.payload || {};
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.isAgent && msg.isTemp && msg.requestId === requestId
              ? { ...msg, text: formatAgentError(error), isTemp: false }
              : msg
          )
        );
        removeThinkingMessage(requestId);
        markAgentDone(requestId);
        return;
      }

      if (message.type === "AGENT_FILLER") {
        const { text, requestId } = message.payload || {};
        if (!text) return;
        const fillerKey = `${requestId}::${String(text).trim()}`;
        if (rememberRecentKey(recentFillerKeysRef, fillerKey, 6000)) return;
        setChatMessages((prev) => {
          const alreadyFinalized = prev.some(
            (msg) =>
              msg.requestId === requestId &&
              msg.isAgent &&
              !msg.isThinking &&
              !msg.isTemp &&
              String(msg.text || "").trim()
          );
          if (alreadyFinalized) return prev;

          const existingThinkingIndex = prev.findIndex(
            (msg) => msg.requestId === requestId && msg.isThinking
          );

          if (existingThinkingIndex >= 0) {
            return prev.map((msg, idx) =>
              idx === existingThinkingIndex ? { ...msg, text } : msg
            );
          }

          const tempIndex = prev.findIndex(
            (msg) => msg.requestId === requestId && msg.isAgent && msg.isTemp
          );
          const fillerMsg = {
            id: nextId(),
            speaker: "Agent",
            text,
            isAgent: true,
            isTemp: false,
            isThinking: true,
            requestId,
          };

          if (tempIndex >= 0) {
            const next = [...prev];
            next.splice(tempIndex, 0, fillerMsg);
            return next;
          }

          return [...prev, fillerMsg];
        });
        return;
      }

      if (message.type === "CAPTION_STATUS") {
        const state = message.payload?.state;
        if (state === "detected") {
          // Container detected only; do not mark as synced until real transcript arrives.
          setLastCaptionDetectedAt(Date.now());
          setCaptionStatus(message.payload || null);
          return;
        }
        if (
          state === "not_found" ||
          state === "empty" ||
          state === "no_transcript"
        ) {
          setLastTranscriptAt(null);
          const recentlyDetected =
            lastCaptionDetectedAt && Date.now() - lastCaptionDetectedAt < 60000;
          if (recentlyDetected) {
            setCaptionStatus({ state: "detected", reason: "sticky_detected" });
            return;
          }
        }
        setCaptionStatus(message.payload || null);
        return;
      }

      if (message.type === "TIMER_UPDATE") {
        return;
      }

      if (message.type !== "LIVE_TRANSCRIPT") return;

      const { action, speaker, finalized, currentSpeech } = message.payload;

      if (action === "update_live") {
        const liveValues = currentSpeech ? Object.values(currentSpeech) : [];
        const hasRealLive = liveValues.some((val) => {
          const text = String(val || "").trim();
          if (!text) return false;
          return !isSystemCaptionText(speaker || "Speaker", text);
        });
        const hasActiveSpeech =
          currentSpeech &&
          Object.values(currentSpeech).some(
            (val) => String(val || "").trim().length > 0
          );
        if (hasActiveSpeech) {
          setLastCaptionDetectedAt(Date.now());
          setCaptionStatus({ state: "detected", reason: "live_text_active" });
          if (hasRealLive) setLastRealTranscriptAt(Date.now());
        }
        return;
      }

      if (action === "finalize" && finalized) {
        const resolvedSpeaker = resolveSpeaker(speaker);
        const normalizedFinalizedText = normalizeSpeaker(finalized);
        setLastTranscriptAt(Date.now());
        if (isSystemCaptionText(resolvedSpeaker.speakerLabel, finalized)) {
          setCaptionStatus(null);
          return;
        }
        if (
          looksLikeHumanName(finalized) &&
          [
            normalizeSpeaker(inferredSelfName),
            normalizeSpeaker(selfDisplayName),
            normalizeSpeaker(meetingData?.userName),
          ]
            .filter(Boolean)
            .includes(normalizedFinalizedText)
        ) {
          setSelfDisplayName((prev) => prev || finalized);
          return;
        }
        if (isSpeakerOnlyText(resolvedSpeaker.speakerLabel, finalized)) {
          return;
        }
        const transcriptKey = makeStableMessageKey(
          resolvedSpeaker.speakerLabel,
          finalized
        );
        if (rememberRecentKey(recentTranscriptKeysRef, transcriptKey, 15000)) {
          return;
        }
        setLastRealTranscriptAt(Date.now());
        setLastCaptionDetectedAt(Date.now());
        setCaptionStatus({ state: "detected", reason: "finalized_transcript" });

        const logSpeaker = resolvedSpeaker.speakerLabel;
        const newLogEntry = `${logSpeaker}: "${finalized}"`;
        if (meetingLogRef.current.includes(newLogEntry)) {
          return;
        }

        const normalizedFinalized = makeStableMessageKey(
          resolvedSpeaker.speakerLabel,
          finalized
        );
        const hasRecentSameBubble = chatMessages.some(
          (msg) =>
            !msg.isAgent &&
            makeStableMessageKey(msg.speaker, msg.text) === normalizedFinalized
        );
        if (hasRecentSameBubble) {
          return;
        }

        const updatedLog = [...meetingLogRef.current, newLogEntry];
        meetingLogRef.current = updatedLog;
        setMeetingLog(updatedLog);
        saveOrUpdateMeeting(updatedLog);

        if (!resolvedSpeaker.isSelf) {
          const finalizedLooksLikeSelfName =
            normalizedFinalizedText &&
            [
              normalizeSpeaker(inferredSelfName),
              normalizeSpeaker(selfDisplayName),
              normalizeSpeaker(meetingData?.userName),
            ]
              .filter(Boolean)
              .includes(normalizedFinalizedText);
          if (finalizedLooksLikeSelfName) {
            return;
          }
          setChatMessages((prevMsgs) => [
            ...prevMsgs,
            {
              id: nextId(),
              speaker: resolvedSpeaker.speakerLabel,
              speakerLabel: resolvedSpeaker.speakerLabel,
              speakerRaw: resolvedSpeaker.rawSpeaker,
              text: finalized,
              isAgent: false,
            },
          ]);
          if (!resolvedSpeaker.isUnknown) {
            queueAgentRequest(resolvedSpeaker.speakerLabel, finalized);
          }
        }

        updateDetectedLanguage(finalized);
      }
    };

  useEffect(() => {
    const handleMessage = (message) => {
      runtimeMessageHandlerRef.current?.(message);
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, () => {});
  }, []);

  const hasRecentTranscript =
    lastRealTranscriptAt && nowTick - lastRealTranscriptAt < 20000;
  const captionsDetected =
    captionStatus?.state === "detected" ||
    (lastCaptionDetectedAt && nowTick - lastCaptionDetectedAt < 60000);
  const statusState = hasRecentTranscript
    ? "synced"
    : captionsDetected
      ? "detected"
      : "waiting";
  const statusLabel =
    statusState === "synced"
      ? "SYNCED"
      : statusState === "detected"
        ? "CAPTIONS ON"
        : "WAITING FOR CAPTIONS";

  const showCaptionWarning =
    (!captionsDetected && statusState !== "synced") ||
    captionStatus?.state === "not_found" ||
    (captionStatus?.state === "no_transcript" && !captionsDetected) ||
    (captionStatus?.state === "empty" && !captionsDetected);

  return (
    <>
      <LiveDock
        messages={chatMessages}
        statusLabel={statusLabel}
        statusState={statusState}
        showCaptionWarning={showCaptionWarning}
        onClose={() => setShowEndConfirm(true)}
        onAsk={handleManualAsk}
        onToast={(message, type) => {
          setToast({ message, type });
          setTimeout(() => setToast(null), 3000);
        }}
        autoCollapseEnabled={autoCollapseEnabled}
        layout="dock"
      />

      {showEndConfirm && (
        <div className="ada-modal-backdrop">
          <div className="ada-modal">
            <div className="ada-modal-title">End session?</div>
            <div className="ada-modal-body">
              Transcript and dossier will be saved to Archives.
            </div>
            <div className="ada-modal-actions">
              <button
                className="ada-btn ada-btn--ghost"
                onClick={() => setShowEndConfirm(false)}
              >
                No
              </button>
              <button
                className="ada-btn ada-btn--primary"
                onClick={finalizeAndClose}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ada-toast-container">
          <div
            className={`ada-toast ${
              toast.type === "error" ? "ada-toast--error" : ""
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </>
  );
}
