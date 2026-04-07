import React, { useEffect, useMemo, useRef, useState } from "react";
import LiveDock from "../component/LiveDock";

const THINKING_PREFIXES = [
  "Hmm... let me think.",
  "That's a good question... let me think.",
  "Let me think for a second...",
  "One moment... thinking.",
  "Give me a second to think...",
  "Hmm... that's interesting. Let me think.",
];
const AGENT_DEBOUNCE_MS = 1500;
const AGENT_MIN_INTERVAL_MS = 3000;
const AGENT_USE_STREAMING = true;
const AGENT_MAX_LOG_LINES = 30;
const AGENT_MAX_LOG_CHARS = 4000;
const FAST_LOG_LINES = 8;
const FAST_LOG_CHARS = 1200;
const AGENT_CONTEXT_MAX_CHARS = 2000;

const pickThinkingPrefix = () =>
  `Thinking: ${
    THINKING_PREFIXES[Math.floor(Math.random() * THINKING_PREFIXES.length)]
  }`;

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
  onExpire,
}) {
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
  const [lastTranscriptAt, setLastTranscriptAt] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [detectedLanguage, setDetectedLanguage] = useState("English");
  const [sessionExpired, setSessionExpired] = useState(false);
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
  const lastHighlightRef = useRef("");

  const nextId = () => ++messageIdRef.current;

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

  const buildAgentMeetingData = () => ({
    ...meetingData,
    businessDNAResult: trimContext(meetingData?.businessDNAResult),
    psychAnalyzerResult: trimContext(meetingData?.psychAnalyzerResult),
    meetingNote: trimContext(meetingData?.meetingNote),
    meetingMessage: trimContext(meetingData?.meetingMessage),
  });

  const removeThinkingMessage = (requestId) => {
    setChatMessages((prev) =>
      prev.filter(
        (msg) => !(msg.isThinking && msg.requestId === requestId)
      )
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
    setSessionExpired(false);
    transcriptIdRef.current = null;
    lastHighlightRef.current = "";
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

  useEffect(() => {
    if (sessionExpired) {
      onExpire?.();
    }
  }, [sessionExpired, onExpire]);

  const normalizeSpeaker = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const mySpeakerAliases = useMemo(() => {
    const aliases = new Set(["you", "me", "ban", "b"]);
    if (meetingData?.userName) {
      aliases.add(normalizeSpeaker(meetingData.userName));
    }
    if (decodedCookieEmail) {
      aliases.add(normalizeSpeaker(decodedCookieEmail));
      const localPart = decodedCookieEmail.split("@")[0];
      if (localPart) aliases.add(normalizeSpeaker(localPart));
    }
    return aliases;
  }, [meetingData?.userName, decodedCookieEmail]);

  const isMySpeech = (speaker) => {
    if (!speaker) return false;
    const norm = normalizeSpeaker(speaker);
    if (!norm) return false;
    return mySpeakerAliases.has(norm);
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

  const createMeetingBlock = () => {
    const newBlockPayload = {
      ...meetingData,
      blockName: meetingData.title || "Untitled Meeting",
      meeting_transcript: meetingLog.join("\n"),
      createdAt: new Date().toISOString(),
    };

    chrome.runtime.sendMessage(
      {
        type: "CREATE_MEETING_PREPARE",
        payload: { email: decodedCookieEmail, payload: newBlockPayload },
      },
      () => {}
    );
  };

  const finalizeAndClose = () => {
    localStorage.setItem("autoSaveEnabled", "true");
    const meetingId = meetingData._id || meetingData.id;
    if (meetingId) {
      saveOrUpdateMeeting(meetingLogRef.current);
    } else {
      createMeetingBlock();
    }
    onBack();
  };

  const sendMessageToAgent = (newMessage, log) => {
    if (sessionExpired) return Promise.resolve(null);

    const requestId = ++reqIdRef.current;
    const thinkingMsg = {
      id: nextId(),
      speaker: "Agent",
      text: pickThinkingPrefix(),
      isAgent: true,
      isTemp: false,
      isThinking: true,
      requestId,
    };
    const tempMsg = {
      id: nextId(),
      speaker: "Agent",
      text: "",
      isAgent: true,
      isTemp: true,
      requestId,
    };

    setChatMessages((prev) => [...prev, thinkingMsg, tempMsg]);

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

    return new Promise(async (resolve, reject) => {
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
    });
  };

  const handleManualAsk = (text) => {
    const msg = {
      id: nextId(),
      speaker: "You",
      text,
      isAgent: false,
    };
    setChatMessages((prev) => [...prev, msg]);
    sendMessageToAgent({ speaker: "You", text }, meetingLogRef.current);
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
      const thinkingMsg = {
        id: nextId(),
        speaker: "Agent",
        text: pickThinkingPrefix(),
        isAgent: true,
        isTemp: false,
        isThinking: true,
        requestId,
      };
      const replyMsg = {
        id: nextId(),
        speaker: "Agent",
        text: fastLocalReply,
        isAgent: true,
        isTemp: false,
        requestId,
      };
      setChatMessages((prev) => [...prev, thinkingMsg]);
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

  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "SESSION_EXPIRED") {
        setSessionExpired(true);
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
        const { text } = message.payload || {};
        if (!text) return;
        setChatMessages((prev) => [
          ...prev,
          { id: nextId(), speaker: "Agent", text, isAgent: true },
        ]);
        return;
      }

      if (message.type === "CAPTION_STATUS") {
        const state = message.payload?.state;
        if (state === "detected") {
          // Container detected only; do not mark as synced until real transcript arrives.
          setCaptionStatus(message.payload || null);
          return;
        }
        if (state === "not_found" || state === "empty" || state === "no_transcript") {
          setLastTranscriptAt(null);
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
          setCaptionStatus(null);
          if (hasRealLive) setLastRealTranscriptAt(Date.now());
        }
        return;
      }

      if (action === "finalize" && finalized) {
        setLastTranscriptAt(Date.now());
        if (isSystemCaptionText(speaker, finalized)) {
          setCaptionStatus(null);
          return;
        }
        if (isSpeakerOnlyText(speaker, finalized)) {
          return;
        }
        setLastRealTranscriptAt(Date.now());

        setMeetingLog((prev) => {
          const newLogEntry = `${speaker}: "${finalized}"`;
          if (prev.includes(newLogEntry)) return prev;

          const updatedLog = [...prev, newLogEntry];
          meetingLogRef.current = updatedLog;
          saveOrUpdateMeeting(updatedLog);

          if (!sessionExpired && !isMySpeech(speaker)) {
            setChatMessages((prevMsgs) => [
              ...prevMsgs,
              { id: nextId(), speaker, text: finalized, isAgent: false },
            ]);
            queueAgentRequest(speaker, finalized);
          }

          return updatedLog;
        });

        updateDetectedLanguage(finalized);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [sessionExpired, detectedLanguage, meetingData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!lastTranscriptAt) {
        setCaptionStatus({ state: "no_transcript" });
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [lastTranscriptAt]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, () => {});
  }, []);

  const statusState =
    lastRealTranscriptAt && nowTick - lastRealTranscriptAt < 15000
      ? "synced"
      : "waiting";
  const statusLabel =
    statusState === "synced" ? "I'm ready to help" : "WAITING FOR CAPTIONS";

  const showCaptionWarning =
    statusState !== "synced" ||
    captionStatus?.state === "not_found" ||
    captionStatus?.state === "no_transcript" ||
    captionStatus?.state === "empty";

  const highlightText = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const msg = chatMessages[i];
      if (msg?.isAgent && msg.isThinking) {
        const text = (msg.text || "").trim();
        if (text) return text;
      }
    }

    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const msg = chatMessages[i];
      if (!msg?.isAgent || msg.isThinking) continue;
      const text = (msg.text || "").trim();
      if (!text) continue;
      if (text.toLowerCase().includes("agent returned empty")) continue;
      lastHighlightRef.current = text;
      return text;
    }
    return lastHighlightRef.current || "";
  }, [chatMessages]);

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
        highlightText={highlightText}
      />

      {showEndConfirm && (
        <div className="ada-modal-backdrop">
          <div className="ada-modal">
            <div className="ada-modal-title">End session?</div>
            <div className="ada-modal-body">
              Debrief will be saved to Archives.
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
