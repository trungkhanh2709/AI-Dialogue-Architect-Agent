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
        <>
          <div className="step-indicator">
            {[1, 2, 3].map((num, idx) => (
              <React.Fragment key={num}>
                <div className={`step-circle ${step >= num ? "active" : ""}`}>{num}</div>
                {idx < 2 && (
                  <div className={`step-line ${step > num ? "active" : ""}`}></div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="section-card">
            {step === 1 && (
              <>
                <div className="section-title">User A - Your Info</div>
                <div className="input-group">
                  <label htmlFor="profileId">Profile Library</label>
                  <select
                    id="profileId"
                    value={formData.profileId}
                    onChange={handleProfileSelect}
                    disabled={profilesLoading}
                  >
                    <option value="">
                      {profilesLoading ? "Loading profiles..." : "Select a profile"}
                    </option>
                    {profiles.map((profile) => (
                      <option key={getProfileId(profile)} value={getProfileId(profile)}>
                        {getProfileDisplayName(profile)}
                      </option>
                    ))}
                  </select>
                  {profilesError ? <div className="error-text">{profilesError}</div> : null}
                </div>
                <div className="input-group">
                  <label htmlFor="conversionArchitectFileId">
                    Conversion Architect File
                  </label>
                  <select
                    id="conversionArchitectFileId"
                    value={formData.conversionArchitectFileId}
                    onChange={handleArtifactSelect}
                    disabled={
                      !formData.profileId ||
                      artifactsLoading ||
                      filteredArtifacts.length === 0
                    }
                  >
                    <option value="">
                      {!formData.profileId
                        ? "Select a profile first"
                        : artifactsLoading
                        ? "Loading files..."
                        : filteredArtifacts.length
                        ? "Select a generated file"
                        : "No files available"}
                    </option>
                    {filteredArtifacts.map((artifact) => (
                      <option key={artifact.id} value={artifact.id}>
                        {getArtifactOptionLabel(artifact)}
                      </option>
                    ))}
                  </select>
                  {artifactsError ? <div className="error-text">{artifactsError}</div> : null}
                </div>

                {/* ── Architect Preview Card ─────────────────────────────── */}
                {formData.conversionArchitectFileId && (() => {
                  let dossier = null;
                  try { dossier = JSON.parse(formData.conversionArchitectDossier || ""); } catch {}

                  const sentimentColor =
                    dossier?.current_sentiment === "Positive" ? "#22c55e"
                    : dossier?.current_sentiment === "Skeptical" ? "#f87171"
                    : "#facc15";

                  const hasData = dossier || formData.conversionArchitectAnalysis;

                  return hasData ? (
                    <div className="architect-preview-card">
                      <button
                        className="architect-preview-toggle"
                        onClick={() => setShowArchitectPreview((v) => !v)}
                        type="button"
                      >
                        <span>📊 Architect Summary</span>
                        <span className="architect-preview-chevron">{showArchitectPreview ? "▲" : "▼"}</span>
                      </button>

                      {showArchitectPreview && (
                        <div className="architect-preview-body">

                          {/* Sentiment badge */}
                          {dossier?.current_sentiment && (
                            <div className="architect-preview-row">
                              <span className="architect-preview-label">Sentiment</span>
                              <span className="architect-preview-badge" style={{ background: sentimentColor }}>
                                {dossier.current_sentiment}
                              </span>
                            </div>
                          )}

                          {/* Prospect summary */}
                          {dossier?.prospect_summary && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">Prospect Summary</div>
                              <div className="architect-preview-text">{dossier.prospect_summary}</div>
                            </div>
                          )}

                          {/* Remaining friction */}
                          {dossier?.remaining_friction && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">🔥 Remaining Friction</div>
                              <div className="architect-preview-text">{dossier.remaining_friction}</div>
                            </div>
                          )}

                          {/* Next objective */}
                          {dossier?.next_strategic_objective && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">🎯 Next Objective</div>
                              <div className="architect-preview-text architect-preview-highlight">
                                {dossier.next_strategic_objective}
                              </div>
                            </div>
                          )}

                          {/* Narrative arc */}
                          {Array.isArray(dossier?.narrative_arc) && dossier.narrative_arc.length > 0 && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">🗺 Narrative Arc</div>
                              {dossier.narrative_arc.map((turn, idx) => (
                                <div className="architect-arc-turn" key={idx}>
                                  <span className="architect-arc-stage">{turn.stage}</span>
                                  <div className="architect-arc-event">{turn.event}</div>
                                  <div className="architect-arc-outcome">{turn.outcome}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Analysis text (truncated) */}
                          {formData.conversionArchitectAnalysis && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">📄 Analysis Sent to Agent</div>
                              <pre className="architect-preview-raw">
                                {formData.conversionArchitectAnalysis.slice(0, 800)}
                                {formData.conversionArchitectAnalysis.length > 800 ? "\n…[truncated]" : ""}
                              </pre>
                            </div>
                          )}

                          {/* Chat output (truncated) */}
                          {formData.conversionArchitectChatOutput && (
                            <div className="architect-preview-section">
                              <div className="architect-preview-section-title">💬 Chat Output Sent</div>
                              <pre className="architect-preview-raw">
                                {formData.conversionArchitectChatOutput.slice(0, 600)}
                                {formData.conversionArchitectChatOutput.length > 600 ? "\n…[truncated]" : ""}
                              </pre>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
                {/* ─────────────────────────────────────────────────────── */}
                {renderInput("userName", "Your Name - Role/Title", "text", "Your name - Role/Title")}
                {renderInput("userCompanyName", "Company Name", "text", "Your Company Name")}
                {renderTextarea(
                  "userCompanyServices",
                  "Your Company: Business, Products, and Services",
                  3,
                  "Please provide clear information about your company, including Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="section-title">User B - Prospect Info</div>
                {renderInput(
                  "prospectName",
                  "Prospect's Name - Role/Title",
                  "text",
                  "Prospect's Name - Role/Title"
                )}
                {renderInput(
                  "customerCompanyName",
                  "Prospect Company Name",
                  "text",
                  "Prospect Company Name"
                )}
                {renderTextarea(
                  "customerCompanyServices",
                  "Prospect Company: Business, Products, and Services",
                  3,
                  "Please provide clear information about your prospect company, including its Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                )}
              </>
            )}

            {step === 3 && (
              <div className="scrollable-step">
                <div className="section-title">Contextual Information</div>
                <ExpandableTextarea
                  id="meetingGoal"
                  label="Meeting Goal"
                  placeholder="Describe your objective clearly (e.g., secure a partnership, schedule a demo, explore collaboration, close a sale)."
                  maxRows={5}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="meetingEmail"
                  label="Email (Optional)"
                  placeholder="Copy and paste the entire email thread with the prospect, including your initial outreach"
                  maxRows={5}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="meetingMessage"
                  label="Social Media Message History (Optional)"
                  placeholder="Copy and paste any relevant social media conversations (e.g., LinkedIn, Twitter) with the prospect. (Optional)"
                  maxRows={5}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="meetingNote"
                  label="Note (Optional)"
                  placeholder="For example, additional information useful for the Agent, such as personality analysis results, BusinessDNA insights, key pain points, potential objections, and relationship history with the prospect, etc."
                  maxRows={5}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="conversionArchitectDossier"
                  label="Conversion Architect Dossier (Optional)"
                  placeholder="Paste the structured dossier from prior meetings if you already have one."
                  maxRows={8}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="conversionArchitectAnalysis"
                  label="Conversion Architect Analysis (Optional)"
                  placeholder="Imported analysis from the selected Conversion Architect file."
                  maxRows={8}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
                <ExpandableTextarea
                  id="conversionArchitectChatOutput"
                  label="Conversion Architect Chat Output (Optional)"
                  placeholder="Imported architect/prospect chat output from the selected file."
                  maxRows={8}
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                />
              </div>
            )}
          </div>

          <div className="btn-container">
            {step > 1 && (
              <button className="btn back" onClick={handleBack}>
                Back
              </button>
            )}
            {step < 3 && (
              <button className="btn next" onClick={handleNext}>
                Next →
              </button>
            )}
            {step === 3 && (
              <button className="btn start" onClick={handleStart}>
                Start
              </button>
            )}
          </div>
        </>
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
