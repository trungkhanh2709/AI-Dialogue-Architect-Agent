import React from "react";

export default function ResultBlock({
  label,              // "AI Psych Analyzer" | "AI BusinessDNA"
  content = "",       // text kết quả (đầy đủ)
  onOpen,             // () => void  -> mở modal xem/sửa
  onRemove,           // optional: () => void  -> xóa block tạm nếu muốn
}) {
  const preview = String(content).slice(0, 220) + (content?.length > 220 ? "…" : "");
  return (
    <div className="rb-card">
      <div className="rb-card__head">
        <div className="rb-card__title">{label}</div>
        <div className="rb-card__actions">
          {onRemove && (
            <button type="button" className="rb-btn rb-btn--ghost" onClick={onRemove}>
              Remove
            </button>
          )}
          <button type="button" className="rb-btn rb-btn--primary" onClick={onOpen}>
            Open
          </button>
        </div>
      </div>
     
    </div>
  );
}
