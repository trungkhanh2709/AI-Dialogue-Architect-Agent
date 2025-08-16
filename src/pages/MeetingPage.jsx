import React, { useState } from "react";
import "../styles/meeting.css";

export default function Meeting() {
  const [log, setLog] = useState([]);
  const [live, setLive] = useState("(waiting...)");
  const [summary, setSummary] = useState("(The summary will appear here)");
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    setLoading(true);
    // giả lập tóm tắt
    setTimeout(() => {
      setSummary("This is a summary of the meeting.");
      setLoading(false);
    }, 1000);
  };

  return (
    <div>
      <h3>Sale Agent</h3>

      <div className="section-title">Meeting Log:</div>
      <div className="log-container">
        {log.length > 0 ? log.map((item, idx) => <div key={idx}>{item}</div>) : "(No logs yet)"}
      </div>

      <div className="section-title">Live Caption:</div>
      <div className="live-container">{live}</div>

      <div style={{ marginTop: 8 }}>
        <button id="btnSummarize" onClick={handleSummarize} disabled={loading}>
          {loading ? "Summarizing..." : "Summary"}
        </button>
      </div>
      <div id="summary">{summary}</div>

      <div className="chat-container">
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
