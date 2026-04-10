import React, { useEffect, useMemo, useRef, useState } from "react";

export default function LiveDock({
  messages,
  statusLabel,
  statusState,
  showCaptionWarning,
  onClose,
  onAsk,
  onToast,
  autoCollapseEnabled = true,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [lastActiveAt, setLastActiveAt] = useState(Date.now());
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const feedRef = useRef(null);

  const displayMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    if (!feedRef.current) return;
    feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, collapsed]);

  useEffect(() => {
    if (collapsed && !manualCollapsed) {
      setCollapsed(false);
    }
  }, [collapsed, manualCollapsed]);

  const markActive = () => {
    setLastActiveAt(Date.now());
    if (collapsed) {
      setCollapsed(false);
      if (manualCollapsed) setManualCollapsed(false);
    }
  };

  const handleAsk = () => {
    const text = input.trim();
    if (!text) return;
    onAsk?.(text);
    setInput("");
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast?.("Copied");
    } catch {
      onToast?.("Copy failed", "error");
    }
  };

  const dockBody = collapsed ? (
    <div
      className="ada-dock ada-dock--collapsed"
      onClick={markActive}
      onMouseMove={markActive}
    >
      <div className="ada-collapse-pill">
        <span className="ada-collapse-pill__wave" aria-hidden="true">
          ///
        </span>
        Architect
      </div>
    </div>
  ) : (
    <div
      className="ada-dock"
      onMouseMove={markActive}
      onFocusCapture={markActive}
    >
      <div className="ada-dock-header">
        <div className="ada-dock-title">AI Dialogue Strategist</div>
        <div className="ada-dock-actions">
          <button
            aria-label="Minimize"
            onClick={() => {
              setManualCollapsed(true);
              setCollapsed(true);
            }}
          >
            -
          </button>
          <button aria-label="Close" onClick={onClose}>
            X
          </button>
        </div>
      </div>

      <div
        className={`ada-status ${
          statusState === "synced" || statusState === "detected"
            ? "ada-status--synced"
            : "ada-status--waiting"
        }`}
      >
        {statusLabel}
      </div>

      {showCaptionWarning && (
        <div className="ada-cc-banner">
          Enable Captions (CC) in Meet settings for real-time assistance.{" "}
          <a
            href="https://support.google.com/meet/answer/9300310"
            target="_blank"
            rel="noreferrer"
          >
            Meet help
          </a>
        </div>
      )}

      <div className="ada-feed" ref={feedRef}>
        {displayMessages.map((msg) => {
          const text = msg.text || "";
          if (msg.isTemp && !text) return null;

          const isThinking = msg.isThinking;
          const isStreaming = msg.isTemp && msg.isAgent && text;

          return (
            <div
              key={msg.id}
              className={`ada-message-row ${msg.isAgent ? "agent" : "user"}`}
            >
              <div
                className={`ada-bubble ${
                  isThinking
                    ? "ada-bubble--thinking"
                    : msg.isAgent
                      ? "ada-bubble--agent"
                      : "ada-bubble--prospect"
                } ${isStreaming ? "ada-bubble--streaming" : ""}`}
              >
                {isThinking && (
                  <span className="ada-thinking-indicator" aria-hidden="true">
                    💭{" "}
                  </span>
                )}
                {text}
                {isStreaming && (
                  <span className="ada-typing-dots">
                    <span />
                    <span />
                    <span />
                  </span>
                )}
                {msg.isAgent && !msg.isTemp && !isThinking && (
                  <button
                    className="ada-copy-btn"
                    onClick={() => handleCopy(msg.text)}
                  >
                    Copy
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!manualCollapsed && (
        <div className="ada-input-row">
          <input
            placeholder="Ask Architect..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setInputFocused(true);
              markActive();
            }}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              markActive();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <button onClick={handleAsk}>Send</button>
        </div>
      )}
    </div>
  );

  return (
    <>{dockBody}</>
  );
}
