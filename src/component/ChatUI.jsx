import React, { useEffect, useRef, useState } from "react";
import "../styles/chat.css";

export default function ChatUI({ messages }) {
  const chatRef = useRef(null);
  const [timer, setTimer] = useState({ minutes: 0, seconds: 0 });

  useEffect(() => {
    if (chatRef.current) {
      const lastAgent = chatRef.current.querySelector(".chat-message.agent:last-child");
      if (lastAgent) {
        const margin = 10;
        chatRef.current.scrollTop = lastAgent.offsetTop - margin;
      }
    }
  }, [messages]);
  
  useEffect(() => {
    // Bật timer khi component mount
    chrome.runtime.sendMessage({ type: "START_TIMER" });

    // Listener cập nhật timer
    const listener = (msg) => {
      if (msg.type === "TIMER_UPDATE") {
        setTimer(msg.payload);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Lấy timer hiện tại nếu reload
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
      if (res) setTimer(res);
    });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  return (
    <div className="chat-container" ref={chatRef}>
      <h3 className="sale-agent-text">AI Dialogue Architect Agent</h3>
      <div>Timer: {timer.minutes.toString().padStart(2, "0")}:{timer.seconds.toString().padStart(2, "0")}</div>

      {messages.map((msg, i) => (
        <div
          className={`chat-message ${msg.isAgent ? "agent" : "user"} ${msg.isTemp ? "typing" : ""}`}
          key={i}
        >
          {!msg.isAgent && <b>{msg.speaker}:</b>}{" "}
          {msg.isSpeaking ? (
            <span className="typing-container">
              <span className="typing-text">speaking</span>
              <span className="typing-dots">
                <span></span><span></span><span></span>
              </span>
            </span>
          ) : msg.isTemp ? (
            <span className="typing-container">
              <span className="typing-text">Agent is responding </span>
              <span className="typing-dots">
                <span></span><span></span><span></span>
              </span>
            </span>
          ) : (
            msg.text
          )}
        </div>
      ))}
    </div>
  );
}
