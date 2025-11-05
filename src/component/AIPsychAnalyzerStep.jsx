// src/components/AIPsychAnalyzerStep.jsx
import React, { useEffect, useState } from "react";

const MIN_URLS = 3;
const LS_PERSONA_KEY = "bm.persona_profile";

export default function AIPsychAnalyzerStep({
  className = "",
  imageSrc ,
  // imageSrc,
  userEmail = "",                 // <-- NEW: truyền từ ngoài (không dùng useAuth)
  initialValues,
  onSubmit,                       // callback khi bấm Analyze Me (nếu bạn cần bắt sự kiện phía ngoài)
  onPersonaSaved,                 // gọi khi “Use as Persona” thành công
  setGlobalToast,                 // show toast ngoài (nếu có)
}) {
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [background, setBackground] = useState(initialValues?.background ?? "");
  const [urls, setUrls] = useState(
    (initialValues?.urls?.length ? initialValues.urls : Array(MIN_URLS).fill(""))
  );
  const [language, setLanguage] = useState(initialValues?.language ?? "English");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");
  const [personaProfile, setPersonaProfile] = useState(() => {
    try { return localStorage.getItem(LS_PERSONA_KEY) || ""; } catch { return ""; }
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedToast, setSavedToast] = useState("");

  const addUrl = () => setUrls(prev => [...prev, ""]);
  
  const imgUrl = chrome.runtime.getURL("images/prospect.jpg");


  const removeUrl = (idx) => {
    setUrls(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      return next.length ? next : [""];
    });
  };
  const changeUrl = (idx, v) => setUrls(prev => prev.map((u, i) => (i === idx ? v : u)));

  const handleSubmit = (e) => {
    e.preventDefault();

    const payload = {
      fullName: fullName.trim(),
      background: background.trim(),
      urls: urls.map(u => u.trim()).filter(Boolean),
      language: language.trim() || "English",
    };
    onSubmit?.(payload);
    try {
      // Xoá persona “đang dùng”
      localStorage.removeItem(LS_PERSONA_KEY);
      localStorage.removeItem("bm.persona_profiles"); // <- nếu không dùng, có thể xoá dòng này
    } catch { }
    setPersonaProfile("");
    setModalText("");
    setSavedToast("");
    setErrorMsg("");
    setModalOpen(false);
    setLoading(true);
    setErrorMsg("");

    // Gọi background để phân tích (SALE_PROSPECT_* như code gốc)
    chrome.runtime.sendMessage({
      type: "SALE_PROSPECT_REQUEST",
      payload: {
        username: userEmail,
        name: fullName,
        biography: background,
        language,
        socialMediaUrl: urls.map((u) => ({ socialMediaUrl: u })),
        query: { firstChat: false, continue: false, content: "" },
        msg: [],
        psychographic_profile: personaProfile || ""
      }
    }, (res) => {
      // callback từ background.sendResponse
      setLoading(false);
      if (chrome.runtime.lastError) {
        setErrorMsg(chrome.runtime.lastError.message || "Runtime error");
        setModalText(chrome.runtime.lastError.message || "Runtime error");
        setModalOpen(true);
        return;
      }
      if (!res?.ok) {
        const text = typeof res?.data === "string" ? res.data : "Request failed.";
        setErrorMsg(text);
        setModalText(String(res?.data ?? ""));
        setModalOpen(true);
        return;
      }
      const data = res.data;
      let text = "";
      if (typeof data === "string") text = data;
      else if (data?.content) text = String(data.content);
      else text = JSON.stringify(data, null, 2);
      setModalText(text);
      setModalOpen(true);
    });
  };

  // useEffect(() => {
  //   const handler = (msg) => {
  //     if (msg?.type !== "SALE_PROSPECT_RESPONSE") return;
  //     console.log("[AI Psych] got response:", msg);

  //     setLoading(false);

  //     if (!msg.ok) {
  //       const text = typeof msg.data === "string" ? msg.data : "Request failed.";
  //       setErrorMsg(text);
  //       setModalText(String(msg.data ?? ""));
  //       setModalOpen(true);
  //       return;
  //     }

  //     const data = msg.data;
  //     let text = "";
  //     if (typeof data === "string") text = data;
  //     else if (data?.content) text = String(data.content);
  //     else text = JSON.stringify(data, null, 2);

  //     setModalText(text);
  //     setModalOpen(true);
  //   };

  //   chrome.runtime.onMessage.addListener(handler);
  //   return () => chrome.runtime.onMessage.removeListener(handler);
  // }, []);

  const useAsPersona = () => {
    const cleaned = (modalText || "").trim();
    setPersonaProfile(cleaned);
    try { localStorage.setItem(LS_PERSONA_KEY, cleaned); } catch { }
    setGlobalToast?.("Persona saved. Moving to Step 2...");
    setSavedToast("Persona saved.");
    setModalOpen(false);
    onPersonaSaved?.();
  };

  return (
    <div className={`bm-s1-wrap ${className}`}>
      <div className="bm-s1-content">
        {/* Hero */}
        <div className="bm-s1-hero">
          <div className="bm-s1-image">
            <img src={imgUrl} alt="AI Psych Analyzer" />
          </div>
          <div className="bm-s1-desc-card">
            <div className="bm-s1-desc-title">Let our agent become you</div>
            <div className="bm-s1-desc-body">
              <strong>AI Psych Analyzer:</strong> Trained on advanced behavioral
              models, the AI Psych Analyzer decodes personality traits,
              motivations, and communication styles—then simulates their mindset.
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="bm-s1-form-card" onSubmit={handleSubmit}>
          <div className="bm-s1-form-grid">
            <label className="bm-s1-label" htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              className="bm-s1-input"
              placeholder="e.g., Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <label className="bm-s1-label" htmlFor="background">
              Background (Copy of LinkedIn CV or detailed Bio)
            </label>
            <textarea
              id="background"
              className="bm-s1-textarea"
              placeholder="Paste LinkedIn summary or detailed bio here..."
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              rows={6}
            />

            <div className="bm-s1-label">URLs (Website / LinkedIn / Other)</div>
            <div className="bm-s1-urls-vertical">
              {urls.map((u, idx) => (
                <div key={idx} className="bm-s1-url-row">
                  <input
                    className="bm-s1-input"
                    placeholder="https://..."
                    value={u}
                    onChange={(e) => changeUrl(idx, e.target.value)}
                    inputMode="url"
                  />
                  <div className="bm-s1-url-actions">
                    <button
                      type="button"
                      className="bm-s1-btn bm-s1-btn--ghost"
                      onClick={() => removeUrl(idx)}
                    >
                      −
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="bm-s1-btn bm-s1-btn--ghost bm-s1-addline"
                onClick={addUrl}
                style={{ marginTop: 6 }}
              >
                + Add URL
              </button>
            </div>

            <label className="bm-s1-label" htmlFor="language">Language</label>
            <input
              id="language"
              className="bm-s1-input"
              placeholder="e.g., English"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </div>

          <div className="bm-s1-actions">
            <button type="submit" className="bm-s1-primary" disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Me"}
            </button>
          </div>

          {errorMsg && <div className="bm-s1-error">{errorMsg}</div>}


        </form>
      </div>

      {savedToast && (
        <div
          style={{
            margin: "8px 16px 0",
            background: "rgba(34,197,94,.15)",
            color: "#16a34a",
            border: "1px solid rgba(34,197,94,.35)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {savedToast}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="bm-modal__backdrop" onClick={() => setModalOpen(false)}>
          <div className="bm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bm-modal__header">
              <div className="bm-modal__title">Prospect Analysis (Editable)</div>
              <button className="bm-modal__close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <div className="bm-modal__body">
              <textarea
                className="bm-modal__textarea"
                value={modalText}
                onChange={(e) => setModalText(e.target.value)}
                rows={16}
              />
            </div>
            <div className="bm-modal__footer">
              <button className="bm-s1-btn bm-s1-btn--ghost" onClick={() => setModalOpen(false)}>
                Close
              </button>
              <button
                className="bm-s1-btn bm-s1-btn--ghost"
                onClick={() => navigator.clipboard?.writeText(modalText).catch(() => { })}
              >
                Copy
              </button>
              <button className="bm-s1-primary" onClick={useAsPersona}>
                Use as Persona
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
