// src/component/ChatUI.jsx
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
          key={i}
          className={`chat-message ${msg.isMe ? "user" : "agent"}`}
        >
          {!msg.isMe && <b>{msg.speaker}:</b>} {msg.text}
        </div>
      ))}
    </div>
  );
}
