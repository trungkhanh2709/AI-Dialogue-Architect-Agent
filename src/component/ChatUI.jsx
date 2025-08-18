import React, { useEffect, useRef } from "react";
import "../styles/chat.css";

export default function ChatUI({ messages }) {
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="chat-container" ref={chatRef}>
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
              <span className="typing-text">Agent đang trả lời </span>
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
