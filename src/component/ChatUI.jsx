import React, { useEffect, useRef, useState } from "react";

export default function ChatUI({
  messages,
  onClose,
  userEmail,
  onTimerChange,
  language,
  languageSource,
  showLanguageConfirm,
  onLanguageSelect,
  captionStatus,
  onCaptionDismiss,
  onOpenLanguageSettings,
}) {
  const chatRef = useRef(null);
  const [timer, setTimer] = useState({ minutes: 0, seconds: 0 });
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  useEffect(() => {
    if (showLanguageConfirm) {
      setShowLanguageOptions(true);
    }
  }, [showLanguageConfirm]);

  useEffect(() => {
    if (!chatRef.current) return;

    let target = chatRef.current.querySelector(
      ".chat-message.agent.typing:last-child"
    );

    if (!target) {
      target = chatRef.current.querySelector(".chat-message.agent:last-child");
    }

    if (target) {
      const timerHeight =
        document.querySelector(".timer-container")?.offsetHeight || 0;
      const margin = 10;
      const targetTop = target.offsetTop;
      chatRef.current.scrollTop = Math.max(targetTop - timerHeight - margin, 0);
    } else {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "START_TIMER" });

    const listener = (msg) => {
      if (msg.type !== "TIMER_UPDATE") return;

      setTimer(msg.payload);
      const timeString = `${msg.payload.minutes
        .toString()
        .padStart(2, "0")}:${msg.payload.seconds
        .toString()
        .padStart(2, "0")}`;
      onTimerChange?.(timeString);
    };

    chrome.runtime.onMessage.addListener(listener);

    chrome.runtime.sendMessage({ type: "GET_TIMER" }, (res) => {
      if (!res) return;

      setTimer(res);
      const timeString = `${res.minutes
        .toString()
        .padStart(2, "0")}:${res.seconds.toString().padStart(2, "0")}`;
      onTimerChange?.(timeString);
    });

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [onTimerChange]);

  return (
    <div className="chat-ui">
      <div className="timer-container">
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

        <p className="agent-text">AI Dialogue Strategist Agent</p>

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
