import React, { useEffect, useState, useRef } from "react";
import "../styles/meeting.css";

export default function Meeting() {
const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const [summary, setSummary] = useState("(The summary will appear here)");
  const speakerTimers = useRef({});
  const liveRef = useRef(null);

  const SPEAKER_TIMEOUT = 1000;

  const cleanMessage = (msg) => msg.trim().replace(/\s+/g, " ");

  const getDeltaText = (speaker, newText) => {
    const newWords = cleanMessage(newText).split(/\s+/);
    const finalizedWords = lastFinalizedWords[speaker] || [];
    const deltaWords = newWords.filter((word) => !finalizedWords.includes(word));
    return deltaWords.join(" ");
  };

  const finalizeSpeech = (speaker) => {
    const message = currentSpeech[speaker];
    if (!message) return;

    const finalized = `${speaker}: "${message}"`;
    setMeetingLog((prev) => [...prev, finalized]);

    setLastFinalizedWords((prev) => ({
      ...prev,
      [speaker]: prev[speaker] ? [...prev[speaker], ...message.split(/\s+/)] : message.split(/\s+/),
    }));

    setCurrentSpeech((prev) => {
      const updated = { ...prev };
      delete updated[speaker];
      return updated;
    });

    console.log("📜 Finalized:", finalized);
  };

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  // Listener chrome message
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "LIVE_TRANSCRIPT") {
        const { action, currentSpeech: cs, meeting_log: ml } = message.payload;
        if (action === "update_live") setCurrentSpeech({ ...cs });
        if (action === "finalize") setMeetingLog([...ml]);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);
  const handleCaptions = () => {
    try {
      const captionBlocks = document.querySelectorAll("div.nMcdL.bj4p3b");
      captionBlocks.forEach((block) => {
        const nameEl = block.querySelector("span.NWpY1d");
        const textEl = block.querySelector("div.ygicle.VbkSUe");

        if (nameEl && textEl) {
          const speaker = nameEl.textContent.trim();
          let message = cleanMessage(textEl.textContent);
          message = getDeltaText(speaker, message);

          if (message) {
            setCurrentSpeech((prev) => ({ ...prev, [speaker]: message }));

            if (speakerTimers.current[speaker]) clearTimeout(speakerTimers.current[speaker]);
            speakerTimers.current[speaker] = setTimeout(() => finalizeSpeech(speaker), SPEAKER_TIMEOUT);
          }
        }
      });
    } catch (err) {
      console.error("❌ handleCaptions error:", err);
    }
  };

  const initObserver = (captionContainer) => {
    const observer = new MutationObserver(handleCaptions);
    observer.observe(captionContainer, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    console.log("✅ Real-time caption streaming activated!");
  };

  useEffect(() => {
    const finder = setInterval(() => {
      const container = document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement;
      if (container) {
        initObserver(container);
        clearInterval(finder);
      }
    }, 300);

    console.log("⏳ Waiting for caption container...");
    return () => clearInterval(finder);
  }, []);

  return (
    <div>
      <h3>Sale Agent</h3>

      <div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>Meeting Log:</div>
      <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #ccc", padding: 5, background: "#fafafa" }}>
        {meetingLog.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>

      <div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>Live Caption:</div>
      <div
        ref={liveRef}
        style={{
          border: "1px solid #ccc",
          margin: "2px 10px",
          padding: 8,
          borderRadius: 5,
          fontStyle: "italic",
          minHeight: 15,
          maxHeight: 80,
          overflowY: "auto",
        }}
      >
        {Object.entries(currentSpeech).map(([speaker, text]) => (
          <div key={speaker}>
            <b>{speaker}:</b> {text}
          </div>
        ))}
        {Object.keys(currentSpeech).length === 0 && "(waiting...)"}
      </div>

      <div style={{ marginTop: 8 }}>
        <button
          style={{
            backgroundColor: "#3a3a3a",
            color: "white",
            border: "none",
            padding: "8px 16px",
            cursor: "pointer",
          }}
          onClick={() => setSummary(meetingLog.join("\n"))}
        >
          Summary
        </button>
      </div>
      <div
        style={{
          marginTop: 8,
          border: "1px solid #ccc",
          padding: 5,
          background: "#e0f7fa",
          minHeight: 40,
        }}
      >
        {summary}
      </div>

      <div className="chat-container" style={{ marginTop: 16 }}>
        <div className="chat-message agent">
          <p>Hello! How can I help you today?</p>
        </div>
        <div className="chat-message user">
          <p>I want to know more about your services.</p>
        </div>
        <div className="chat-message agent">
          <p>Sure! We offer software development and AI solutions.</p>
        </div>
      </div>
    </div>
  );
}
