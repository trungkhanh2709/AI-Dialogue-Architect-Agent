import React, { useEffect, useState } from "react";
import PopupWithSidebar from "../component/PopupWithSidebar.jsx";
import ExpandableTextarea from "../component/ExpandableTextarea.jsx";
import SettingLineLight from "../assets/Setting_line_light.svg?react";
import SettingsPage from "../component/SettingsPage.jsx";
import {
  filterArtifactsByProfile,
  getArtifactOptionLabel,
  getProfileDisplayName,
  getProfileId,
  mergeArtifactIntoFormData,
  mergeProfileIntoFormData,
  normalizeConversionArchitectArtifacts,
} from "../utils/strategistBridge";

const DEFAULT_AGENT_MODEL_KEY = "groq";

export default function PopupPage({ onStartMeeting, cookieUserName }) {
  const [remainSessions, setRemainSessions] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    profileId: "",
    profileName: "",
    userName: "",
    userCompanyName: "",
    userCompanyServices: "",
    cognitiveCloneTone: "",
    prospectName: "",
    customerCompanyName: "",
    customerCompanyServices: "",
    meetingGoal: "",
    meetingEmail: "",
    meetingMessage: "",
    meetingNote: "",
    conversionArchitectFileId: "",
    conversionArchitectFileName: "",
    psychAnalyzerResult: "",
    businessDNAResult: "",
    conversionArchitectDossier: "",
    conversionArchitectAnalysis: "",
    conversionArchitectChatOutput: "",
    agentModelKey: DEFAULT_AGENT_MODEL_KEY,
  });
  const [errors, setErrors] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  const [conversionArchitectArtifacts, setConversionArchitectArtifacts] = useState([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState("");
  const [showArchitectPreview, setShowArchitectPreview] = useState(false);
  const decodedCookieEmail = decodeURIComponent(cookieUserName || "");
  const [tab, setTab] = useState("schedule");
  const selectedProfile = profiles.find(
    (profile) => getProfileId(profile) === String(formData.profileId || "")
  );
  const filteredArtifacts = filterArtifactsByProfile(
    conversionArchitectArtifacts,
    selectedProfile
  );
const [brandDNA, setBrandDNA] = useState(null);
const isCognitiveActive = !!brandDNA?.data?.cognitive_clone_tone?.trim();

useEffect(() => {
  if (!decodedCookieEmail) return;

  chrome.runtime.sendMessage(
    {
      type: "GET_BRAND_DNA",
      payload: { email: decodedCookieEmail },
    },
    (res) => {
      if (res?.ok && res.data?.length) {
        const primary = res.data.find(
          (x) => x.data?.is_primary
        ) || res.data[0];

        setBrandDNA(primary);
      }
    }
  );
}, [decodedCookieEmail]);

useEffect(() => {
  chrome.storage.local.get("brandDNA", (result) => {
    if (result.brandDNA?.length) {
      const primary =
        result.brandDNA.find((x) => x.data?.is_primary) ||
        result.brandDNA[0];

      setBrandDNA(primary);
    }
  });
}, []);

  useEffect(() => {
    if (!decodedCookieEmail) return;

    chrome.runtime.sendMessage(
      {
        type: "GET_REMAIN_SESSIONS",
        payload: {
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent",
        },
      },
      (res) => {
        if (res?.error || !res?.data) {
          setRemainSessions("0 sessions");
          return;
        }
        const { value, trial } = res.data.content || {};
        setRemainSessions(trial ? `${value} sessions + Trial` : `${value} sessions`);
      }
    );
  }, [decodedCookieEmail]);

  useEffect(() => {
    if (!decodedCookieEmail) return;

    setProfilesLoading(true);
    setProfilesError("");
    chrome.runtime.sendMessage(
      {
        type: "GET_PROFILES",
        payload: { email: decodedCookieEmail },
      },
      (response) => {
        setProfilesLoading(false);
        if (!response?.ok || !Array.isArray(response?.data)) {
          setProfiles([]);
          setProfilesError(response?.error || "Unable to load profiles.");
          return;
        }
        setProfiles(response.data);
      }
    );
  }, [decodedCookieEmail]);

  useEffect(() => {
    if (!decodedCookieEmail) return;

    setArtifactsLoading(true);
    setArtifactsError("");
    chrome.runtime.sendMessage(
      {
        type: "GET_CONVERSION_ARCHITECT_FILES",
        payload: { take: 50 },
      },
      (response) => {
        setArtifactsLoading(false);
        if (!response?.ok) {
          setConversionArchitectArtifacts([]);
          const detailsMsg =
            response?.data?.message ||
            response?.data?.detail ||
            response?.data?.error;
          const statusPart =
            typeof response?.status === "number"
              ? ` (HTTP ${response.status})`
              : "";
          console.error("GET_CONVERSION_ARCHITECT_FILES failed", response);
          setArtifactsError(
            response?.error ||
              detailsMsg ||
              `Unable to load Conversion Architect files${statusPart}.`
          );
          return;
        }

        setConversionArchitectArtifacts(
          normalizeConversionArchitectArtifacts(response?.data)
        );
      }
    );
  }, [decodedCookieEmail]);

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.userName.trim()) newErrors.userName = "Required field";
      if (!formData.userCompanyName.trim())
        newErrors.userCompanyName = "Required field";
      if (!formData.userCompanyServices.trim())
        newErrors.userCompanyServices = "Required field";
    }
    if (step === 2) {
      if (!formData.prospectName.trim()) newErrors.prospectName = "Required field";
      if (!formData.customerCompanyName.trim())
        newErrors.customerCompanyName = "Required field";
      if (!formData.customerCompanyServices.trim())
        newErrors.customerCompanyServices = "Required field";
    }
    if (step === 3) {
      if (!formData.meetingGoal.trim()) newErrors.meetingGoal = "Required field";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleProfileSelect = (event) => {
    const profileId = event.target.value;
    if (!profileId) {
      setFormData((prev) => ({
        ...prev,
        profileId: "",
        profileName: "",
        psychAnalyzerResult: "",
        businessDNAResult: "",
        conversionArchitectFileId: "",
        conversionArchitectFileName: "",
        conversionArchitectDossier: "",
        conversionArchitectAnalysis: "",
        conversionArchitectChatOutput: "",
        meetingMessage:
          prev.meetingMessage === prev.conversionArchitectChatOutput
            ? ""
            : prev.meetingMessage,
      }));
      return;
    }

    const profile = profiles.find((item) => getProfileId(item) === profileId);
    if (!profile) return;

    setFormData((prev) =>
      mergeProfileIntoFormData(
        {
          ...prev,
          profileId,
          profileName: getProfileDisplayName(profile),
          psychAnalyzerResult: "",
          businessDNAResult: "",
          conversionArchitectFileId: "",
          conversionArchitectFileName: "",
          conversionArchitectDossier: "",
          conversionArchitectAnalysis: "",
          conversionArchitectChatOutput: "",
          meetingMessage:
            prev.meetingMessage === prev.conversionArchitectChatOutput
              ? ""
              : prev.meetingMessage,
        },
        profile
      )
    );
  };

  const handleArtifactSelect = (event) => {
    const artifactId = event.target.value;
    if (!artifactId) {
      setFormData((prev) => ({
        ...prev,
        psychAnalyzerResult: "",
        businessDNAResult: "",
        conversionArchitectFileId: "",
        conversionArchitectFileName: "",
        conversionArchitectDossier: "",
        conversionArchitectAnalysis: "",
        conversionArchitectChatOutput: "",
        meetingMessage:
          prev.meetingMessage === prev.conversionArchitectChatOutput
            ? ""
            : prev.meetingMessage,
      }));
      return;
    }

    const fallbackArtifact = filteredArtifacts.find((item) => item.id === artifactId);

    setFormData((prev) => ({
      ...prev,
      conversionArchitectFileId: artifactId,
      conversionArchitectFileName: fallbackArtifact?.title || "",
    }));

    chrome.runtime.sendMessage(
      {
        type: "GET_CONVERSION_ARCHITECT_FILE",
        payload: { fileId: artifactId },
      },
      (response) => {
        if (!response?.ok) {
          console.error("GET_CONVERSION_ARCHITECT_FILE failed", {
            response,
            fileId: artifactId,
          });
        }
        const detailArtifacts = normalizeConversionArchitectArtifacts(
          response?.data ? [response.data] : []
        );
        const artifact = detailArtifacts[0] || fallbackArtifact;
        if (!artifact) return;
        setFormData((prev) => mergeArtifactIntoFormData(prev, artifact));
        setShowArchitectPreview(true); // auto-open preview after file loaded
      }
    );
  };

  const handleNext = () => {
    if (validateStep()) setStep((prev) => prev + 1);
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const handleStart = () => {
    if (!validateStep()) return;
    chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
      chrome.runtime.sendMessage({ type: "START_TIMER" });
    });
    onStartMeeting(formData);
  };

  const renderTextarea = (id, label, rows = 3, placeholder) => {
    const words =
      formData[id].trim() === "" ? [] : formData[id].trim().split(/\s+/);
    const wordCount = words.length;

    return (
      <div className="input-group">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          value={formData[id]}
          onChange={(e) => {
            const newWords =
              e.target.value.trim() === "" ? [] : e.target.value.trim().split(/\s+/);
            if (newWords.length <= 1000) {
              handleChange(e);
            } else {
              e.target.value = formData[id];
              alert("Maximum 1000 words allowed");
            }
          }}
          placeholder={placeholder}
          rows={rows}
          className={errors[id] ? "input-error" : ""}
        />
        <div className="word-counter">{wordCount}/1000 words</div>
        {errors[id] && <div className="error-text">{errors[id]}</div>}
      </div>
    );
  };

  const renderInput = (id, label, type = "text", placeholder) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <input
        type={type}
        id={id}
        placeholder={placeholder}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );

  useEffect(() => {
    setStep(tab === "instant" ? 1 : 0);
  }, [tab]);

  useEffect(() => {
    if (!formData.profileId || !formData.conversionArchitectFileId) return;
    const isStillValid = filteredArtifacts.some(
      (artifact) => artifact.id === formData.conversionArchitectFileId
    );

    if (!isStillValid) {
      setFormData((prev) => ({
        ...prev,
        psychAnalyzerResult: "",
        businessDNAResult: "",
        conversionArchitectFileId: "",
        conversionArchitectFileName: "",
        conversionArchitectDossier: "",
        conversionArchitectAnalysis: "",
        conversionArchitectChatOutput: "",
        meetingMessage:
          prev.meetingMessage === prev.conversionArchitectChatOutput
            ? ""
            : prev.meetingMessage,
      }));
    }
  }, [filteredArtifacts, formData.profileId, formData.conversionArchitectFileId]);

  return (
    <div className="extension-container">
      <div className="tab-container">
        <div
          className={`tab-item ${tab === "instant" ? "active" : ""}`}
          onClick={() => setTab("instant")}
        >
          Instant
        </div>
        <div className="divider"></div>
        <div
          className={`tab-item ${tab === "schedule" ? "active" : ""}`}
          onClick={() => setTab("schedule")}
        >
          Schedule
        </div>
      </div>

      <div className="agent-header">
        <p className="agent_name">AI Dialogue Strategist Agent</p>
        <SettingLineLight
          size={8}
          className="settings-icon"
          onClick={() => setTab("settings")}
        />
      </div>

      <div
        className={`session-remain ${
          remainSessions === "0 sessions" ? "danger" : "normal"
        }`}
      >
        Remaining Sessions: {remainSessions || "Loading..."}
      </div>

     {tab === "instant" && (
  <div className="instant-container">

    {/* STATUS BAR */}
    <div className="top-bar">
      <div className="title">⚡ STRATEGY LAB</div>

      <div className="status-pills">
<span className={`pill ${isCognitiveActive ? "active" : "inactive"}`}>
  ▦ Cognitive Clone: {isCognitiveActive ? "Active" : "Inactive"}
</span>
        <span className="pill">⚡ Skills: NEPQ + Negotiation + Psychology</span>
      </div>
    </div>

    {/* CONTEXT BAR */}
<div className="context-bar">
  ▼ [ ■ ] BRAND DNA: {brandDNA?.data?.nameOfBusiness || "Loading..."}
</div>

    {/* INPUTS */}
    <div className="section-card">

      {/* MEETING GOAL */}
      <div className="input-group">
        <label>Meeting Goal</label>
        <textarea
          id="meetingGoal"
          value={formData.meetingGoal}
          onChange={handleChange}
          placeholder="e.g., Secure partnership"
          className={errors.meetingGoal ? "input-error" : ""}
        />
        {errors.meetingGoal && (
          <div className="error-text">{errors.meetingGoal}</div>
        )}
      </div>

      {/* ADDITIONAL CONTEXT */}
      <div className="input-group">
        <label>Additional Context (Message History / Psych Insights)</label>
        <textarea
          id="meetingNote"
          value={formData.meetingNote}
          onChange={handleChange}
          placeholder="Paste email threads, social messages, insights..."
        />
      </div>

      {/* DOSSIER */}
      <div className="dossier-section">
        <button className="btn-dossier">
          ◪ ATTACH DOSSIER
        </button>
        <div className="dossier-hint">
          Loads Conversion Architect + Psych/Business DNA
        </div>
      </div>
    </div>

    {/* CTA */}
    <button className="btn-start-full" onClick={handleStart}>
      ◪ START REAL-TIME STRATEGY
    </button>
  </div>
)}

      {tab === "schedule" && (
        <div className="schedule-container">
          <PopupWithSidebar
            onStartMeeting={onStartMeeting}
            decodedCookieEmail={decodedCookieEmail}
            onSelectBlock={(block) => console.log("Selected:", block)}
          />
        </div>
      )}

      {tab === "settings" && <SettingsPage onBack={() => setTab("instant")} />}
    </div>
  );
}
