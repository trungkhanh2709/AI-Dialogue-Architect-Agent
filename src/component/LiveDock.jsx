import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_DOCK_RECT = {
  x: null,
  y: 72,
  width: 1040,
  height: 720,
};

const MIN_DOCK_WIDTH = 360;
const MIN_DOCK_HEIGHT = 240;
const MAX_DOCK_WIDTH_RATIO = 0.9;
const MAX_DOCK_HEIGHT_RATIO = 0.9;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function LiveDock({
  messages,
  statusLabel,
  statusState,
  showCaptionWarning,
  onClose,
  onAsk,
  onToast,
  autoCollapseEnabled = true,
  layout = "dock", // "dock" | "overlay" | "sidepanel"
}) {
  const isSidePanel = layout === "sidepanel";
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [lastActiveAt, setLastActiveAt] = useState(Date.now());
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const restoreDockRectRef = useRef(null);
  const [dockRect, setDockRect] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ada_dock_rect") || "null");
      return saved && typeof saved === "object"
        ? { ...DEFAULT_DOCK_RECT, ...saved }
        : DEFAULT_DOCK_RECT;
    } catch {
      return DEFAULT_DOCK_RECT;
    }
  });
  const feedRef = useRef(null);
  const dragStateRef = useRef(null);
  const resizeStateRef = useRef(null);

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

  useEffect(() => {
    try {
      localStorage.setItem("ada_dock_rect", JSON.stringify(dockRect));
    } catch {}
  }, [dockRect]);

  useEffect(() => {
    const onPointerMove = (e) => {
      if (layout !== "dock") return;
      if (dragStateRef.current) {
        const { offsetX, offsetY, width, height } = dragStateRef.current;
        const maxX = window.innerWidth - width - 12;
        const maxY = window.innerHeight - height - 12;
        setDockRect((prev) => ({
          ...prev,
          x: clamp(e.clientX - offsetX, 12, Math.max(12, maxX)),
          y: clamp(e.clientY - offsetY, 12, Math.max(12, maxY)),
        }));
        return;
      }

      if (resizeStateRef.current) {
        const { startX, startY, startWidth, startHeight, x, y } =
          resizeStateRef.current;
        const nextWidth = clamp(
          startWidth + (e.clientX - startX),
          MIN_DOCK_WIDTH,
          Math.floor(window.innerWidth * MAX_DOCK_WIDTH_RATIO)
        );
        const nextHeight = clamp(
          startHeight + (e.clientY - startY),
          MIN_DOCK_HEIGHT,
          Math.floor(window.innerHeight * MAX_DOCK_HEIGHT_RATIO)
        );
        setDockRect((prev) => ({
          ...prev,
          x:
            x == null
              ? prev.x
              : clamp(x, 12, Math.max(12, window.innerWidth - nextWidth - 12)),
          y: clamp(y, 12, Math.max(12, window.innerHeight - nextHeight - 12)),
          width: nextWidth,
          height: nextHeight,
        }));
      }
    };

    const stopPointer = () => {
      dragStateRef.current = null;
      resizeStateRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopPointer);
    window.addEventListener("pointercancel", stopPointer);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopPointer);
      window.removeEventListener("pointercancel", stopPointer);
    };
  }, []);

  const markActive = () => {
    setLastActiveAt(Date.now());
    if (collapsed) {
      setCollapsed(false);
      if (manualCollapsed) setManualCollapsed(false);
    }
  };

  const toggleMaximize = () => {
    if (layout !== "dock" || isSidePanel) return;
    setMaximized((prev) => {
      const next = !prev;
      if (next) {
        restoreDockRectRef.current = dockRect;
        const nextWidth = Math.floor(window.innerWidth * 0.92);
        const nextHeight = Math.floor(window.innerHeight * 0.92);
        setDockRect((current) => ({
          ...current,
          x: 12,
          y: 12,
          width: clamp(nextWidth, MIN_DOCK_WIDTH, Math.floor(window.innerWidth * MAX_DOCK_WIDTH_RATIO)),
          height: clamp(
            nextHeight,
            MIN_DOCK_HEIGHT,
            Math.floor(window.innerHeight * MAX_DOCK_HEIGHT_RATIO)
          ),
        }));
      } else if (restoreDockRectRef.current) {
        setDockRect(restoreDockRectRef.current);
      }
      return next;
    });
  };

  const handleAsk = () => {
    const text = input.trim();
    if (!text) return;
    onAsk?.(text);
    setInput("");
  };

  const swallowEvent = (e) => {
    e.stopPropagation();
  };

  const startDrag = (e) => {
    if (layout !== "dock" || isSidePanel) return;
    if (e.target.closest("button")) return;
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  };

  const startResize = (e) => {
    if (layout !== "dock" || isSidePanel) return;
    swallowEvent(e);
    const targetDock = e.currentTarget.closest(".ada-dock");
    if (!targetDock) return;
    const rect = targetDock.getBoundingClientRect();
    resizeStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      x: rect.left,
      y: rect.top,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "nwse-resize";
  };

  const dockStyle =
    collapsed
      ? undefined
      : {
          left:
            dockRect.x == null
              ? `calc(50% - ${Math.round((dockRect.width || DEFAULT_DOCK_RECT.width) / 2)}px)`
              : `${dockRect.x}px`,
          top: `${dockRect.y || DEFAULT_DOCK_RECT.y}px`,
          width: `${dockRect.width || DEFAULT_DOCK_RECT.width}px`,
          height: `${dockRect.height || DEFAULT_DOCK_RECT.height}px`,
          transform: "none",
        };

  const overlayContainer =
    layout === "overlay" && !collapsed ? (
      <div className="ada-overlay" onMouseMove={markActive} onClick={markActive}>
        <div className="ada-overlay__inner">
          {/** dockBody will be injected below */}
        </div>
      </div>
    ) : null;

  const dockBody = collapsed && !isSidePanel ? (
    <div className="ada-dock ada-dock--collapsed" onClick={markActive} onMouseMove={markActive}>
      <div className="ada-collapse-pill">
        <span className="ada-collapse-pill__wave" aria-hidden="true">
          ///
        </span>
        Strategist
      </div>
    </div>
  ) : (
    <div
      className={`ada-dock ${layout === "overlay" ? "ada-dock--overlay" : ""} ${isSidePanel ? "ada-dock--sidepanel" : ""}`}
      style={layout === "dock" && !isSidePanel ? dockStyle : undefined}
      onMouseMove={markActive}
      onFocusCapture={markActive}
    >
      <div
        className="ada-dock-header"
        onPointerDown={isSidePanel ? undefined : startDrag}
      >
        <div className="ada-dock-title">AI Dialogue Strategist</div>
        <div className="ada-dock-actions">
          {layout === "dock" && !isSidePanel && (
            <button
              type="button"
              aria-label={maximized ? "Restore" : "Maximize"}
              title={maximized ? "Restore" : "Maximize"}
              onMouseDown={swallowEvent}
              onClick={(e) => {
                swallowEvent(e);
                toggleMaximize();
              }}
            >
              {maximized ? "Restore" : "Maximize"}
            </button>
          )}
          {!isSidePanel && (
            <button
              type="button"
              aria-label="Minimize"
              onMouseDown={swallowEvent}
              onClick={(e) => {
                swallowEvent(e);
                setManualCollapsed(true);
                setCollapsed(true);
              }}
            >
              -
            </button>
          )}
          <button
            type="button"
            aria-label="Close"
            onMouseDown={swallowEvent}
            onClick={(e) => {
              swallowEvent(e);
              onClose?.();
            }}
          >
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
              {!msg.isAgent && (
                <div
                  className="ada-speaker-label"
                  title={msg.speakerRaw ? `Raw speaker: ${msg.speakerRaw}` : ""}
                >
                  {msg.speakerLabel || msg.speaker || "Unknown Speaker"}
                </div>
              )}
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
              </div>
            </div>
          );
        })}
      </div>

      {(!manualCollapsed || isSidePanel) && (
        <div className="ada-input-row">
          <input
            placeholder="Ask Strategist..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onMouseDown={swallowEvent}
            onClick={swallowEvent}
            onFocus={() => {
              markActive();
              setInputFocused(true);
            }}
            onBlur={() => setInputFocused(false)}
            onKeyDown={(e) => {
              swallowEvent(e);
              markActive();
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
          <button
            type="button"
            onMouseDown={swallowEvent}
            onClick={(e) => {
              swallowEvent(e);
              handleAsk();
            }}
          >
            Send
          </button>
        </div>
      )}
      {layout === "dock" && !isSidePanel && (
        <div
          className="ada-resize-handle"
          onPointerDown={startResize}
          title="Resize"
        />
      )}
    </div>
  );

  if (layout === "overlay" && !collapsed && !isSidePanel) {
    return (
      <div className="ada-overlay" onMouseMove={markActive} onClick={markActive}>
        <div className="ada-overlay__inner" onClick={swallowEvent} onMouseDown={swallowEvent}>
          {dockBody}
        </div>
      </div>
    );
  }

  return <>{dockBody}</>;
}
