// src/components/ResultModal.jsx
import React from "react";
// optional: rely on your existing CSS classes
// import "../styles/result-modal.css";

const LS_PSYCH_KEY = "bm.result.psych_analyzer";
const LS_BDNA_KEY  = "bm.result.business_dna";

// Extract block content by section title tag: [AI Psych Analyzer] / [AI BusinessDNA]
function extractBlocks(allText) {
  const text = String(allText || "");

  const readBlock = (label) => {
    // Matches: [LABEL]\n ... (until the next \n[Something] or end)
    const re = new RegExp(
      String.raw`^\s*\[${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\]\s*([\s\S]*?)(?=\n\s*\[[^\]]+\]|\s*$)`,
      "im"
    );
    const m = text.match(re);
    return m ? m[1].trim() : "";
  };

  return {
    psych: readBlock("AI Psych Analyzer"),
    bdna:  readBlock("AI BusinessDNA"),
  };
}

function saveSectionToLocalStorage(key, content) {
  try {
    // Remove old if exists
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
    }
    // Save new
    const payload = {
      updatedAt: new Date().toISOString(),
      content: String(content || "").trim(),
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.error("LocalStorage save error:", err);
    return false;
  }
}

export default function ResultModal({
  open,
  title = "Generated Results",
  value,
  setValue,
  onClose,
  onCopy,
  onSaveToNote, // optional: will be called after built-in LS save
}) {
  if (!open) return null;

  const handleSaveToNote = () => {
    const { psych, bdna } = extractBlocks(value);

    let savedAny = false;
    let messages = [];

    if (psych) {
      const ok = saveSectionToLocalStorage(LS_PSYCH_KEY, psych);
      savedAny = savedAny || ok;
      messages.push(ok ? "Saved Psych Analyzer" : "Failed Psych Analyzer");
    } else {
      messages.push("No [AI Psych Analyzer] block found");
    }

    if (bdna) {
      const ok = saveSectionToLocalStorage(LS_BDNA_KEY, bdna);
      savedAny = savedAny || ok;
      messages.push(ok ? "Saved BusinessDNA" : "Failed BusinessDNA");
    } else {
      messages.push("No [AI BusinessDNA] block found");
    }

    alert(messages.join(" • "));

    // Optional callback for caller (e.g., also append back to meetingNote)
    onSaveToNote?.({ psych, bdna });

    // Close modal after saving (optional; keep if you want)
    // onClose?.();
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
          <button className="bm-btn bm-btn--primary" onClick={handleSaveToNote}>
            Save to Note
          </button>
        </div>
      </div>
    </div>
  );
}
