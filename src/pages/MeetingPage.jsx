import React, { useEffect, useState, useRef } from "react";
import "../styles/meeting.css";

export default function Meeting() {
  const [currentSpeech, setCurrentSpeech] = useState({});
  const [meetingLog, setMeetingLog] = useState([]);
  const [lastFinalizedWords, setLastFinalizedWords] = useState({});
  const [summary, setSummary] = useState("(The summary will appear here)");
  const speakerTimers = useRef({});
  const liveRef = useRef(null);



  
  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  // Listener chrome message
  
  

  
useEffect(() => {
const handleMessage = (message) => {
  if (message.type !== "LIVE_TRANSCRIPT") return;
  const { action, speaker, finalized, currentSpeech: liveSpeech } = message.payload;

  if (action === "update_live" && liveSpeech) {
    setCurrentSpeech(prev => {
      // loại bỏ phần duplicate với lastFinalizedWords
      const updated = { ...prev };
      Object.entries(liveSpeech).forEach(([spk, text]) => {
        const deltaText = getDeltaText(spk, text);
        if (deltaText) updated[spk] = deltaText;
      });
      return updated;
    });
  }

if (action === "finalize" && finalized) {
  setMeetingLog(prev => {
    // tránh duplicate
    if (prev.some(l => l === `${speaker}: "${finalized}"`)) return prev;
    return [...prev, `${speaker}: "${finalized}"`];
  });

  // Xóa live của speaker đã finalize
  setCurrentSpeech(prev => {
    const updated = { ...prev };
    delete updated[speaker];
    return updated;
  });

  // Cập nhật lastFinalizedWords React state luôn
  setLastFinalizedWords(prev => ({
    ...prev,
    [speaker]: [...(prev[speaker] || []), ...finalized.split(/\s+/)]
  }));
}
};
  chrome.runtime.onMessage.addListener(handleMessage);
  return () => chrome.runtime.onMessage.removeListener(handleMessage);
}, []);



  useEffect(() => {
    const finder = setInterval(() => {
      const container = document.querySelector("div.nMcdL.bj4p3b")
        ?.parentElement?.parentElement;
      if (container) {
        initObserver(container);
        clearInterval(finder);
      }
    }, 300);

    console.log("⏳ Waiting for caption container...");
    return () => clearInterval(finder);
  }, []);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech, meetingLog]);
  
  
  return (
    <div>
      <h3>Sale Agent</h3>

      {/* Delete duplicate rendering */}
<div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>
  Meeting Log:
</div>
<div
  style={{
    maxHeight: 150,
    overflowY: "auto",
    border: "1px solid #ccc",
    padding: 5,
    background: "#fafafa",
  }}
>
  {meetingLog.map((log, i) => (
    <div key={i}>{log}</div>
  ))}
</div>


      <div style={{ fontWeight: "bold", marginTop: 8, marginBottom: 4 }}>
        Live Caption:
      </div>
      <div ref={liveRef}>
       {Object.entries(currentSpeech).map(([speaker, text]) => {
  const deltaText = getDeltaText(speaker, text);
  return deltaText ? (
    <div key={speaker}>
      <b>{speaker}:</b> {deltaText}
    </div>
  ) : null;
})}
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