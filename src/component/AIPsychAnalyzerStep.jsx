// src/components/AIPsychAnalyzerStep.jsx
import React from "react";

export default function AIPsychAnalyzerStep({
  className = "",
  heroImageSrc,
  heroTitle,
  heroDescription,
  checked = false,         // ✅ trạng thái chọn agent
  onToggle,                // ✅ callback khi tick/untick
}) {
  const handleChange = (e) => {
    if (onToggle) onToggle(e.target.checked);
  };

  return (
    <div className={`bm-s1-wrap ${className}`}>
      <div className="bm-s1-content">
        <div className="bm-s1-hero">
          {/* Left: Ảnh + checkbox */}
          <div className="bm-s1-hero-left">
            {heroImageSrc && (
              <div className="bm-s1-image">
                <img src={heroImageSrc} alt={heroTitle || "Analyzer"} />
              </div>
            )}
            <label className="bm-s1-option">
              <input
                type="checkbox"
                checked={checked}
                onChange={handleChange}
              />
              <span>Use this agent</span>
            </label>
          </div>

          {/* Right: Text */}
          <div className="bm-s1-desc-card">
            {heroTitle && (
              <div className="bm-s1-desc-title">
                {heroTitle}
              </div>
            )}
            {heroDescription && (
              <div className="bm-s1-desc-body">
                {heroDescription}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
