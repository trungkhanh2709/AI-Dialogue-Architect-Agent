import React, { useEffect, useMemo, useState } from "react";
import SettingLineLight from "../assets/Setting_line_light.svg?react";

const GOAL_TEMPLATES = {
  "Discovery Call":
    "Run a discovery call to understand the prospect's needs, timeline, and decision criteria.",
  Demo: "Deliver a tailored demo that highlights the most relevant outcomes.",
  Closing: "Confirm fit, handle final objections, and secure the close.",
  Negotiation: "Align on terms and remove blockers to reach agreement.",
  Partnership: "Explore partnership structure, mutual goals, and next steps.",
  Custom: "",
};

const DEFAULT_QUOTA_TOTAL = 500;
const MODEL_OPTIONS = [
  { key: "groq", label: "Groq" },
  { key: "gemini", label: "Gemini" },
  { key: "kimi", label: "Kimi" },
];

const sendMessageAsync = (message) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (res) => resolve(res));
  });

const getIntelCacheKey = (profileId) => `ada_intel_${profileId}`;

const loadIntelCache = async (profileId) => {
  if (!profileId) return null;
  const key = getIntelCacheKey(profileId);

  try {
    const chromeCached = await new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve(null);
        return;
      }
      chrome.storage.local.get([key], (result) => {
        resolve(result?.[key] || null);
      });
    });
    if (chromeCached) return chromeCached;
  } catch {}

  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

const saveIntelCache = async (profileId, intel) => {
  if (!profileId) return;
  const key = getIntelCacheKey(profileId);

  try {
    localStorage.setItem(key, JSON.stringify(intel));
  } catch {}

  try {
    await new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve();
        return;
      }
      chrome.storage.local.set({ [key]: intel }, () => resolve());
    });
  } catch {}
};

const extractContent = (data) => {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data?.content === "string") return data.content;
  if (typeof data?.data?.content === "string") return data.data.content;
  return JSON.stringify(data, null, 2);
};

const pickTextFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return "";
  const candidates = [
    "final",
    "business_dna",
    "businessDna",
    "psych_profile",
    "psychProfile",
    "content",
    "draft",
    "report",
    "result",
    "text",
  ];
  for (const key of candidates) {
    if (typeof obj[key] === "string") return obj[key];
  }
  if (typeof obj?.data === "string") return obj.data;
  if (typeof obj?.data?.content === "string") return obj.data.content;
  return "";
};

const cleanIntelLines = (text) => {
  const lines = String(text)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\r/g, "")
    .split("\n");

  const metaLinePatterns = [
    /^status\s*:/i,
    /^draft\s*:/i,
    /^final\s*:/i,
    /^role\s*:/i,
    /^target entity\s*:/i,
    /^target\s*:/i,
    /^subject\s*:/i,
    /^current date\s*:/i,
    /^date of analysis\s*:/i,
    /^prime directive\s*:/i,
    /^classification\s*:/i,
    /^executing\b/i,
  ];

  const cleaned = [];
  let started = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\*\*/g, "").trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }

    if (metaLinePatterns.some((pattern) => pattern.test(trimmed))) {
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      continue;
    }

    if (
      /^(executive summary|detailed analysis|strategic prediction|the wedge|the breaking news)/i.test(
        trimmed
      )
    ) {
      started = true;
    }

    if (!started) {
      // Skip noisy preambles until the first user-meaningful section appears.
      continue;
    }

    cleaned.push(line);
  }

  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s*##+\s*/g, "\n")
    .trim();
};

const formatIntelContent = (raw) => {
  if (!raw) return "";
  let text = raw;

  if (typeof text !== "string") {
    text = JSON.stringify(text, null, 2);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      const picked = pickTextFromObject(parsed);
      if (picked) {
        text = picked;
      } else if (Array.isArray(parsed)) {
        text = parsed.map((item) => formatIntelContent(item)).join("\n");
      } else if (parsed && typeof parsed === "object") {
        text = Object.entries(parsed)
          .map(([key, value]) => {
            const line =
              typeof value === "string"
                ? value
                : JSON.stringify(value, null, 0);
            return `${key}: ${line}`;
          })
          .join("\n");
      }
    } catch {
      // keep raw
    }
  }

  const cleaned = cleanIntelLines(text);
  return cleaned || String(text).trim();
};
const normalizeIntel = (data) => {
  if (!data) return { businessDna: "", psychProfile: "" };
  return {
    businessDna:
      data.business_dna ||
      data.businessDNA ||
      data.business_dna_report ||
      data.businessDna ||
      "",
    psychProfile:
      data.psych_profile ||
      data.psychProfile ||
      data.psychographic_profile ||
      data.psychAnalyzerResult ||
      "",
  };
};

export default function PopupPage({ onStartMeeting, cookieUserName }) {
  const [voiceLoaded, setVoiceLoaded] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [intel, setIntel] = useState({ businessDna: "", psychProfile: "" });
  const [intelLoading, setIntelLoading] = useState({
    business: false,
    psych: false,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    prospectName: "",
    linkedinUrl: "",
    objective: "",
    notes: "",
    goalTemplate: "",
  });
  const [errors, setErrors] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [previewModal, setPreviewModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(
    localStorage.getItem("autoSaveEnabled") === "true"
  );
  const [autoCollapseEnabled, setAutoCollapseEnabled] = useState(
    localStorage.getItem("ada_autoCollapse") !== "false"
  );
  const [showPsychPrompt, setShowPsychPrompt] = useState(false);
  const [quota, setQuota] = useState({
    used: 0,
    remaining: DEFAULT_QUOTA_TOTAL,
    total: DEFAULT_QUOTA_TOTAL,
    loading: true,
  });
  const [cloneData, setCloneData] = useState(null);
  const [agentModelKey, setAgentModelKey] = useState(
    localStorage.getItem("ada_agent_model") || "groq"
  );

  const decodedCookieEmail = useMemo(() => {
    if (!cookieUserName) return "";
    try {
      return decodeURIComponent(cookieUserName);
    } catch {
      return cookieUserName;
    }
  }, [cookieUserName]);

  const pushToast = (type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000
    );
  };

  useEffect(() => {
    if (localStorage.getItem("autoSaveEnabled") === null) {
      localStorage.setItem("autoSaveEnabled", "true");
      setAutoSaveEnabled(true);
    }
    if (localStorage.getItem("ada_autoCollapse") === null) {
      localStorage.setItem("ada_autoCollapse", "true");
      setAutoCollapseEnabled(true);
    }
    if (localStorage.getItem("ada_agent_model") === null) {
      localStorage.setItem("ada_agent_model", "groq");
      setAgentModelKey("groq");
    }
  }, []);

  useEffect(() => {
    if (!decodedCookieEmail) return;

    const loadVoice = async () => {
      setVoiceLoading(true);
      try {
        const cached = JSON.parse(
          localStorage.getItem("ada_clone_cache") || "null"
        );
        if (cached) {
          setCloneData(cached);
          setVoiceLoaded(true);
        }
      } catch {}
      const res = await sendMessageAsync({
        type: "GET_USER_CLONE",
        payload: { email: decodedCookieEmail },
      });
      if (res?.ok) {
        setCloneData(res.data || null);
        setVoiceLoaded(true);
        try {
          localStorage.setItem(
            "ada_clone_cache",
            JSON.stringify(res.data || {})
          );
        } catch {}
      } else {
        setVoiceLoaded(false);
      }
      setVoiceLoading(false);
    };

    const loadProfiles = async () => {
      setProfilesLoading(true);
      try {
        const cachedProfiles = JSON.parse(
          localStorage.getItem("ada_profiles_cache") || "null"
        );
        if (Array.isArray(cachedProfiles) && cachedProfiles.length) {
          setProfiles(cachedProfiles);
        }
      } catch {}
      const res = await sendMessageAsync({
        type: "GET_PROFILES",
        payload: { email: decodedCookieEmail },
      });
      const data = res?.data;
      if (Array.isArray(data)) {
        setProfiles(data);
        try {
          localStorage.setItem("ada_profiles_cache", JSON.stringify(data));
        } catch {}
      } else if (Array.isArray(data?.profiles)) {
        setProfiles(data.profiles);
        try {
          localStorage.setItem(
            "ada_profiles_cache",
            JSON.stringify(data.profiles)
          );
        } catch {}
      } else {
        setProfiles([]);
      }
      setProfilesLoading(false);
    };

    const loadQuota = async () => {
      const res = await sendMessageAsync({
        type: "GET_QUOTA",
        payload: {
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent",
        },
      });
      if (res?.ok && res.data) {
        const raw = res.data;
        const total =
          Number(raw.total_minutes || raw.total || raw.limit || DEFAULT_QUOTA_TOTAL) ||
          DEFAULT_QUOTA_TOTAL;
        const used = Number(raw.used_minutes || raw.used || 0) || 0;
        const remaining =
          Number(raw.remaining_minutes || raw.remaining || total - used) ||
          total - used;
        setQuota({ used, remaining, total, loading: false });
      } else if (res?.fallback) {
        const remaining = Number(res.fallback.remaining || 0) || 0;
        setQuota({
          used: Math.max(DEFAULT_QUOTA_TOTAL - remaining, 0),
          remaining,
          total: DEFAULT_QUOTA_TOTAL,
          loading: false,
        });
      } else {
        setQuota((prev) => ({ ...prev, loading: false }));
      }
    };

    loadVoice();
    loadProfiles();
    loadQuota();
  }, [decodedCookieEmail]);

  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return profiles;
    const term = searchTerm.toLowerCase();
    return profiles.filter((profile) => {
      const name = (
        profile.nameOfBusiness ||
        profile.entity_name ||
        profile.name ||
        profile.full_name ||
        profile.fullName ||
        ""
      ).toLowerCase();
      const company = (
        profile.typeOfBusiness ||
        profile.sub_type ||
        profile.type ||
        ""
      ).toLowerCase();
      return name.includes(term) || company.includes(term);
    });
  }, [profiles, searchTerm]);

  const quotaLevel = useMemo(() => {
    const remaining = quota.remaining ?? DEFAULT_QUOTA_TOTAL;
    if (remaining > 200) return "ada-pill--success";
    if (remaining > 50) return "ada-pill--warn";
    return "ada-pill--danger";
  }, [quota.remaining]);

  const handleSelectProfile = async (profileId) => {
    setSelectedProfileId(profileId);
    const profile =
      profiles.find((p) => String(p._id || p.id) === String(profileId)) || null;
    setSelectedProfile(profile);

    const defaultName =
      profile?.name ||
      profile?.full_name ||
      profile?.fullName ||
      profile?.nameOfBusiness ||
      profile?.entity_name ||
      form.prospectName;
    const defaultLinkedin =
      profile?.linkedin ||
      profile?.linkedin_url ||
      profile?.profile_url ||
      profile?.url ||
      form.linkedinUrl;

    setForm((prev) => ({
      ...prev,
      prospectName: defaultName || "",
      linkedinUrl: defaultLinkedin || "",
    }));

    if (profileId) {
      const cached = await loadIntelCache(profileId);
      if (cached) {
        setIntel({
          businessDna: cached.businessDna || "",
          psychProfile: cached.psychProfile || "",
        });
      } else {
        setIntel({ businessDna: "", psychProfile: "" });
      }
    } else {
      setIntel({ businessDna: "", psychProfile: "" });
    }

    if (!profileId) return;
  };

  const buildPsychPayload = () => {
    return {
      username: decodedCookieEmail || "",
      name: form.prospectName?.trim() || "",
      biography:
        selectedProfile?.summary ||
        selectedProfile?.description ||
        selectedProfile?.about ||
        "",
      language: "English",
      socialMediaUrl: (form.linkedinUrl || "")
        .trim()
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => ({ socialMediaUrl: u })),
      query: { firstChat: false, continue: false, content: "" },
      msg: [],
      psychographic_profile: "",
      context: {
        prospectCompanyName:
          selectedProfile?.company ||
          selectedProfile?.company_name ||
          selectedProfile?.companyName ||
          "",
      },
    };
  };

  const buildBusinessDnaPayload = () => {
    const urls =
      selectedProfile?.urls ||
      selectedProfile?.company_urls ||
      selectedProfile?.companyUrls ||
      [];
    return {
      query: { firstChat: false, continue: false, content: "" },
      msg: [],
      nameOfBusiness:
        selectedProfile?.company ||
        selectedProfile?.company_name ||
        selectedProfile?.companyName ||
        "",
      typeOfBusiness:
        selectedProfile?.industry ||
        selectedProfile?.business ||
        selectedProfile?.companyServices ||
        "",
      companyUrl:
        selectedProfile?.company_website ||
        selectedProfile?.companyWebsite ||
        selectedProfile?.website ||
        "",
      countryOrRegion: "",
      socialMediaUrl: Array.isArray(urls)
        ? urls
            .map((u) => (u || "").trim())
            .filter(Boolean)
            .map((u) => ({ socialMediaUrl: u }))
        : [],
      prospectName: form.prospectName?.trim() || "",
      username: decodedCookieEmail || "",
    };
  };

  const handleGenerate = async (type) => {
    if (!selectedProfileId) {
      pushToast("error", "Select a profile to proceed.");
      return;
    }
    if (type === "business") {
      setIntelLoading((prev) => ({ ...prev, business: true }));
      const payload = buildBusinessDnaPayload();
      const res = await sendMessageAsync({
        type: "BUSINESS_DNA_REQUEST",
        payload,
      });
      if (res?.ok) {
        const content = extractContent(res.data);
        const next = { ...intel, businessDna: content };
        setIntel(next);
        pushToast("success", "Business DNA Loaded");
        await saveIntelCache(selectedProfileId, next);
      } else {
        pushToast("error", "Generation failed - retry?");
      }
      setIntelLoading((prev) => ({ ...prev, business: false }));
      return;
    }

    if (type === "psych") {
      setIntelLoading((prev) => ({ ...prev, psych: true }));
      const payload = buildPsychPayload();
      const res = await sendMessageAsync({
        type: "SALE_PROSPECT_REQUEST",
        payload,
      });
      if (res?.ok) {
        const content = extractContent(res.data);
        const next = { ...intel, psychProfile: content };
        setIntel(next);
        pushToast("success", "Psych Profile Loaded");
        await saveIntelCache(selectedProfileId, next);
      } else {
        pushToast("error", "Generation failed - retry?");
      }
      setIntelLoading((prev) => ({ ...prev, psych: false }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!selectedProfileId) {
      nextErrors.profile = "Select a profile to proceed.";
    }
    if (!form.prospectName.trim()) {
      nextErrors.prospectName = "Required for speaker detection.";
    }
    if (!form.objective.trim() || form.objective.trim().length < 10) {
      nextErrors.objective = "Goal is required.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleActivate = async () => {
    if (!validate()) return;
    if (!intel.businessDna || !intel.psychProfile) {
      pushToast("error", "Load both Intelligence sources to activate.");
      return;
    }
    if (!decodedCookieEmail) {
      pushToast("error", "Please log in to continue.");
      return;
    }

    const meetCheck = await sendMessageAsync({ type: "CHECK_MEET_TAB" });
    if (!meetCheck?.ok) {
      pushToast("error", "Open Google Meet first");
      return;
    }

    const sessionRes = await sendMessageAsync({
      type: "USE_ADDON_SESSION",
      payload: {
        email: decodedCookieEmail,
        add_on_type: "ai_dialogue_architect_agent",
      },
    });

    if (
      !sessionRes?.data ||
      !(
        sessionRes.data.trial_used === true || sessionRes.data.status === "200"
      )
    ) {
      pushToast("error", "You have run out of sessions.");
      return;
    }

    chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
      chrome.runtime.sendMessage({ type: "START_TIMER" });
    });

    onStartMeeting({
      userName:
        cloneData?.full_name ||
        cloneData?.name ||
        cloneData?.username ||
        decodedCookieEmail ||
        "User",
      userCompanyName:
        cloneData?.nameOfBusiness ||
        cloneData?.company ||
        cloneData?.companyName ||
        "",
      userCompanyServices:
        cloneData?.typeOfBusiness ||
        cloneData?.industry ||
        cloneData?.services ||
        "",
      prospectName: form.prospectName,
      customerCompanyName:
        selectedProfile?.company ||
        selectedProfile?.company_name ||
        selectedProfile?.companyName ||
        "",
      customerCompanyServices:
        selectedProfile?.industry ||
        selectedProfile?.business ||
        selectedProfile?.companyServices ||
        "",
      meetingGoal: form.objective,
      meetingNote: form.notes,
      businessDNAResult: intel.businessDna,
      psychAnalyzerResult: intel.psychProfile,
      profileId: selectedProfileId,
      agentModelKey,
    });
  };

  const handleTemplateChange = (value) => {
    setForm((prev) => ({
      ...prev,
      goalTemplate: value,
      objective: GOAL_TEMPLATES[value] ?? prev.objective,
    }));
  };

  const openPreview = (title, content) => {
    setPreviewModal({ title, content });
  };

  const intelReady = Boolean(intel.businessDna && intel.psychProfile);

  useEffect(() => {
    if (!previewModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPreviewModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewModal]);

  return (
    <>
      <div className="ada-panel">
        <div className="ada-topbar">
          <div className="ada-title">AI Dialogue Strategist</div>
          <div className="ada-topbar-right">
            <div className={`ada-pill ${quotaLevel}`}>
              Live Assist:{" "}
              {quota.loading
                ? "Loading..."
                : `${quota.used} / ${quota.total} Min`}
            </div>
            <div
              className={`ada-pill ${
                voiceLoaded ? "ada-pill--success" : "ada-pill--warn"
              }`}
            >
              {voiceLoading
                ? "Your Voice: Loading..."
                : voiceLoaded
                ? "Your Voice: Loaded"
                : "Your Voice: Not Loaded"}
            </div>
            <button
              className="ada-icon-button"
              aria-label="Open settings"
              onClick={() => setShowSettings(true)}
            >
              <SettingLineLight width={16} height={16} />
            </button>
          </div>
        </div>

        <div className="ada-panel-body">
          <div className="ada-section">
            <div className="ada-section-title">Section 1: The Target</div>
            <div className="ada-field">
              <label className="ada-label" htmlFor="profile-search">
                Profile Selector
              </label>
              <input
                id="profile-search"
                className="ada-input"
                placeholder="Search or select from Library..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="ada-select"
                value={selectedProfileId}
                onChange={(e) => handleSelectProfile(e.target.value)}
              >
                <option value="" disabled>
                  {profilesLoading
                    ? "Loading profiles..."
                    : "Select a profile"}
                </option>
                {filteredProfiles.map((profile) => {
                  const id = profile._id || profile.id;
                  const name =
                    profile.nameOfBusiness ||
                    profile.entity_name ||
                    profile.name ||
                    profile.full_name ||
                    profile.fullName ||
                    profile.company ||
                    profile.company_name ||
                    profile.companyName ||
                    "Profile";
                  const company =
                    profile.typeOfBusiness ||
                    profile.sub_type ||
                    profile.type ||
                    "";
                  const updatedRaw =
                    profile.updated_at ||
                    profile.updatedAt ||
                    profile.last_updated ||
                    "";
                  const updated =
                    typeof updatedRaw === "string" ? updatedRaw : "";
                  const label = `${name}${
                    company ? ` - ${company}` : ""
                  }${updated ? ` - ${updated}` : ""}`;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {errors.profile && (
                <div className="ada-error-text">{errors.profile}</div>
              )}
            </div>

            <div className="ada-intel-row">
              {intel.businessDna ? (
                <button
                  className="ada-pill ada-pill--success"
                  onClick={() =>
                    openPreview("Business DNA", intel.businessDna || "")
                  }
                  aria-label="Business DNA loaded"
                >
                  <span aria-hidden="true">{"\u{1F7E2}"}</span>{" "}
                  Business DNA: LOADED
                </button>
              ) : (
                <button
                  className="ada-btn ada-btn--primary ada-btn--small"
                  disabled={intelLoading.business}
                  onClick={() => handleGenerate("business")}
                  aria-label="Generate Business DNA report"
                >
                  {intelLoading.business ? (
                    <>
                      <span className="ada-spinner" aria-hidden="true" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{"\u26A1"}</span> GENERATE DNA
                    </>
                  )}
                </button>
              )}

              {intel.psychProfile ? (
                <button
                  className="ada-pill ada-pill--success"
                  onClick={() =>
                    openPreview("Psych Profile", intel.psychProfile || "")
                  }
                  aria-label="Psych Profile loaded"
                >
                  <span aria-hidden="true">{"\u{1F7E2}"}</span>{" "}
                  Psych Profile: LOADED
                </button>
              ) : (
                <button
                  className="ada-btn ada-btn--primary ada-btn--small"
                  disabled={intelLoading.psych}
                  onClick={() => handleGenerate("psych")}
                  aria-label="Generate Psych Profile report"
                >
                  {intelLoading.psych ? (
                    <>
                      <span className="ada-spinner" aria-hidden="true" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">{"\u26A1"}</span> GENERATE
                      PSYCH
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="ada-field">
              <label className="ada-label" htmlFor="prospectName">
                Prospect Name
              </label>
              <input
                id="prospectName"
                className="ada-input"
                value={form.prospectName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, prospectName: e.target.value }))
                }
                placeholder="e.g., Billy Tea"
              />
              {errors.prospectName && (
                <div className="ada-error-text">{errors.prospectName}</div>
              )}
            </div>

            <div className="ada-field">
              <label className="ada-label" htmlFor="linkedinUrl">
                LinkedIn URL (Optional)
              </label>
              <input
                id="linkedinUrl"
                className="ada-input"
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, linkedinUrl: e.target.value }))
                }
                onBlur={() => {
                  if (!form.linkedinUrl.trim()) return;
                  if (!intel.psychProfile) {
                    setShowPsychPrompt(true);
                  }
                }}
                placeholder="e.g., linkedin.com/in/billytea"
              />
            </div>

            <div className="ada-field">
              <label className="ada-label">AI Model</label>
              <div className="ada-model-row">
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`ada-btn ada-btn--small ${
                      agentModelKey === option.key
                        ? "ada-btn--primary"
                        : "ada-btn--ghost"
                    }`}
                    onClick={() => {
                      setAgentModelKey(option.key);
                      localStorage.setItem("ada_agent_model", option.key);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ada-section">
            <div className="ada-section-title">Section 2: The Objective</div>
            <div className="ada-field">
              <label className="ada-label" htmlFor="goalTemplate">
                Goal Template
              </label>
              <select
                id="goalTemplate"
                className="ada-select"
                value={form.goalTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
              >
                <option value="">Select Goal Template (optional)</option>
                {Object.keys(GOAL_TEMPLATES).map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            <div className="ada-field">
              <label className="ada-label" htmlFor="objective">
                Objective
              </label>
              <textarea
                id="objective"
                className="ada-textarea"
                rows={4}
                placeholder="Describe your objective, e.g., secure a partnership, close a sale."
                value={form.objective}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, objective: e.target.value }))
                }
              />
              {errors.objective && (
                <div className="ada-error-text">{errors.objective}</div>
              )}
            </div>
            <div className="ada-field">
              <label className="ada-label" htmlFor="notes">
                Manual Context / Notes
              </label>
              <textarea
                id="notes"
                className="ada-textarea"
                rows={3}
                placeholder="Paste email/social history, or notes like 'Focus on ROI objections'."
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <div className="ada-footer">
          <button
            className="ada-btn ada-btn--ghost"
            onClick={() => {
              const host = document.getElementById("__ai_dialogue_toolbar__");
              if (host) host.style.display = "none";
            }}
          >
            Cancel
          </button>
          <button
            className="ada-btn ada-btn--primary"
            disabled={!intelReady}
            title={
              intelReady
                ? ""
                : "Load both Intelligence sources (or Generate now) to activate."
            }
            onClick={handleActivate}
          >
            <span aria-hidden="true">{"\u{1F680}"}</span> ACTIVATE ARCHITECT
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="ada-modal-backdrop">
          <div className="ada-modal">
            <div className="ada-modal-title">Settings</div>
            <div className="ada-toggle-row">
              <div className="ada-toggle-copy">
                <div className="ada-label">
                  Auto-save debrief to ReelSights AI Hub
                </div>
              </div>
              <label className="ada-switch" aria-label="Auto-save debrief to ReelSights AI Hub">
                <input
                  className="ada-switch__input"
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => {
                    setAutoSaveEnabled(e.target.checked);
                    localStorage.setItem(
                      "autoSaveEnabled",
                      e.target.checked ? "true" : "false"
                    );
                  }}
                />
                <span className="ada-switch__slider" />
              </label>
            </div>
            <div className="ada-toggle-row">
              <div className="ada-toggle-copy">
                <div className="ada-label">Auto-collapse live dock</div>
              </div>
              <label className="ada-switch" aria-label="Auto-collapse live dock">
                <input
                  className="ada-switch__input"
                  type="checkbox"
                  checked={autoCollapseEnabled}
                  onChange={(e) => {
                    setAutoCollapseEnabled(e.target.checked);
                    localStorage.setItem(
                      "ada_autoCollapse",
                      e.target.checked ? "true" : "false"
                    );
                  }}
                />
                <span className="ada-switch__slider" />
              </label>
            </div>
            <div className="ada-field">
              Monthly Limit: {quota.total} Minutes. Used: {quota.used} Minutes.
            </div>
            <div className="ada-modal-actions">
              <button
                className="ada-btn ada-btn--ghost"
                onClick={() => setShowSettings(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewModal && (
        <div className="ada-modal-backdrop">
          <div className="ada-modal">
            <div className="ada-modal-title">
              {previewModal.title}
              <button
                className="ada-modal-close"
                aria-label="Close preview"
                onClick={() => setPreviewModal(null)}
              >
                ×
              </button>
            </div>
            <div className="ada-modal-body ada-intel-text">
              {formatIntelContent(previewModal.content)}
            </div>
            <div className="ada-modal-actions">
              <button
                className="ada-btn ada-btn--ghost"
                onClick={() => setPreviewModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPsychPrompt && (
        <div className="ada-modal-backdrop">
          <div className="ada-modal">
            <div className="ada-modal-title">
              Generate Psych Profile from this URL?
            </div>
            <div className="ada-modal-actions">
              <button
                className="ada-btn ada-btn--ghost"
                onClick={() => setShowPsychPrompt(false)}
              >
                No
              </button>
              <button
                className="ada-btn ada-btn--primary"
                onClick={() => {
                  setShowPsychPrompt(false);
                  handleGenerate("psych");
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ada-toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`ada-toast ${
              toast.type === "error" ? "ada-toast--error" : ""
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  );
}
