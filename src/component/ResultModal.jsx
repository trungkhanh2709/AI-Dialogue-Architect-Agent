// src/components/ResultModal.jsx
import React from "react";

export default function ResultModal({
  open,
  title = "Generated Results",
  value,
  setValue,
  onClose,
  onCopy,
  onSave,
  onNext,
}) {
  if (!open) return null;

  const handleSaveAndNext = () => {
    onSave?.(value);
    onNext?.();
  };

  return (
    <div className="bm-modal__backdrop" onClick={onClose}>
      <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bm-modal__header">
          <div className="bm-modal__title">{title}</div>
          <button className="bm-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="bm-modal__body">
          <textarea
            className="bm-modal__textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={18}
            spellCheck={false}
          />
        </div>

        <div className="bm-modal__footer">
          <button className="bm-btn bm-btn--ghost" onClick={onClose}>Close</button>
          <button className="bm-btn bm-btn--ghost" onClick={onCopy}>Copy</button>
          <button className="bm-btn bm-btn--primary" onClick={handleSaveAndNext}>
            Save & Next
          </button>
        </div>
      </div>
    </div>
  );
}
