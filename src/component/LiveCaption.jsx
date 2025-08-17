import React, { useEffect, useRef } from "react";

export function LiveCaption({ currentSpeech }) {
  const liveRef = useRef(null);

  useEffect(() => {
    if (liveRef.current) {
      liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }
  }, [currentSpeech]);

  return (
    <div
      ref={liveRef}
      style={{
        maxHeight: 120,
        overflowY: "auto",
        border: "1px solid #aaa",
        padding: 5,
        background: "#fffde7",
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 4 }}>Live Speaking:</div>
      {Object.entries(currentSpeech).map(([speaker, text]) => (
        <div key={speaker} style={{ marginBottom: 2 }}>
          <b>{speaker}:</b> {text}
        </div>
      ))}
    </div>
  );
}
