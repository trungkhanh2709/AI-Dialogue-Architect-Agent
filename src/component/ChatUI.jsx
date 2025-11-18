import React, { useEffect, useRef, useState } from "react";
// import "../styles/chat.css";

export default function ChatUI({ messages, onClose, userEmail, setSessionExpired }) {
  const chatRef = useRef(null);
  const [timer, setTimer] = useState({ minutes: 0, seconds: 0 });

 useEffect(() => {
  if (!chatRef.current) return;

  // ƯU TIÊN: bubble agent đang stream (isTemp = true)
  let target = chatRef.current.querySelector(
    ".chat-message.agent.typing:last-child"
  );

  // Nếu không có bubble đang stream -> fallback về agent cuối cùng
  if (!target) {
    target = chatRef.current.querySelector(".chat-message.agent:last-child");
  }

  if (target) {
    const timerHeight =
      document.querySelector(".timer-container")?.offsetHeight || 0;
    const margin = 10;

    const targetTop = target.offsetTop;
    chatRef.current.scrollTop = Math.max(
      targetTop - timerHeight - margin,
      0
    );
  } else {
    // Không tìm được message => fallback scroll xuống cuối
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }
}, [messages]);


  useEffect(() => {
    // Bật timer khi component mount
    chrome.runtime.sendMessage({ type: "START_TIMER" });

    // Listener cập nhật timer
    const listener = (msg) => {
      if (msg.type === "TIMER_UPDATE") {
        setTimer(msg.payload);
        if (msg.payload.minutes === 0 && msg.payload.seconds === 0) {
          setSessionExpired(true); // cái này sẽ trigger onExpire ở MeetingPage
          chrome.runtime.sendMessage({ type: "SESSION_EXPIRED" });
        }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    // Lấy timer hiện tại nếu reload
    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
      if (res) setTimer(res);
    });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [setSessionExpired]);

  return (
    <div className="chat-ui">
      <div className="timer-container">
        {/* trái */}
        <div className="timer-and-text">
          <div className="record-button">
            <div className="outer-circle"></div>
            <div className="inner-circle"></div>
          </div>
          <div className="digital-timer">
            <span className="mm">
              {timer.minutes.toString().padStart(2, "0")}
            </span>
            <span className={`colon ${timer.seconds % 2 === 0 ? "" : "off"}`}>
              :
            </span>
            <span className="ss">
              {timer.seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* giữa */}
        <p className="agent-text">AI Dialogue Architect Agent</p>

        {/* phải */}
        <button className="close-btn" onClick={onClose}>
          <span className="line line1"></span>
          <span className="line line2"></span>
        </button>
      </div>

      <div className="chat-container" ref={chatRef}>
        {messages.map((msg, i) => (
          <div
            className={`chat-message ${msg.isAgent ? "agent" : "user"} ${
              msg.isTemp ? "typing" : ""
            }`}
            key={i}
          >
            {!msg.isAgent && <b>{msg.speaker}:</b>}{" "}
            {msg.isSpeaking ? (
              <span className="typing-container">
                <span className="typing-text">speaking</span>
                <span className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            ) : msg.isTemp ? (
              // STREAM MODE: vừa show text đang stream, vừa show typing dots
              <span className="typing-container">
                <span className="typing-text">
                  {msg.text && msg.text.trim().length
                    ? msg.text
                    : "Agent is responding"}
                </span>
                <span className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </span>
            ) : (
              msg.text
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
