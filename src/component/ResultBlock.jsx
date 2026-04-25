import React from "react";

export default function ResultBlock({
  label,
  content = "",
  onOpen,
  onRemove,
}) {
  const preview =
    String(content).slice(0, 100) +
    (content?.length > 100 ? "…" : "");

  return (
    <div className="rb-card">
      <div className="rb-card__head">
        <div className="rb-card__title">{label}</div>

        <div className="rb-card__actions">
          {onRemove && (
            <button
              type="button"
              className="rb-btn rb-btn--ghost"
              onClick={onRemove}
            >
              Remove
            </button>
          )}

          <button
            type="button"
            className="rb-btn rb-btn--primary"
            onClick={onOpen}
          >
            Open
          </button>
        </div>
      </div>

      <div className="rb-card__preview">
        {preview || "No content yet..."}
      </div>
    </div>
  );
}