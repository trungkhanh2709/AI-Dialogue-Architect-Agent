// src/components/PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import SideBar from "./Sidebar";
import InboxOutlined from "../assets/InboxOutlined.svg?react";
import InputField from "./InputField";
import GoogleCalendar from "./GoogleCalendar";
import ExpandableTextarea from "./ExpandableTextarea";
import CollapsibleSection from "./CollapsibleSection";
import ResultModal from "./ResultModal";

const LS_PERSONA_KEY = "bm.persona_profile"; // optional, used if available

export default function PopupWithSidebar({
  onStartMeeting,
  onSelectBlock,
  decodedCookieEmail,
}) {
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    userName: "",
    userCompanyName: "",
    userCompanyServices: "",
    prospectName: "",
    customerCompanyName: "",
    customerCompanyServices: "",
    meetingGoal: "",
    meetingEmail: "",
    meetingMessage: "",
    meetingNote: "",
    meetingStart: "",
    meetingDuration: "15",
    meetingEnd: "",
    guestEmail: "",
    meetingLink: "",
    // merged Step 1 fields
    psychBackground: "",
    psychUrls: ["", "", ""],
    psychLanguage: "English",
  });
  const [errors, setErrors] = useState({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [openSections, setOpenSections] = useState([1]);

  // checkboxes + generating state
  const [runBusinessDNA, setRunBusinessDNA] = useState(false);
  const [runPsych, setRunPsych] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState("");

  useEffect(() => {
    if (selectedBlock) {
      setFormData((prev) => ({
        ...prev,
        title: selectedBlock.blockName || "",
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
        meetingStart: selectedBlock.meetingStart || "",
        meetingDuration: selectedBlock.meetingDuration || "15",
        meetingEnd: selectedBlock.meetingEnd || "",
        guestEmail: selectedBlock.guestEmail || "",
        meetingLink: selectedBlock.meetingLink || "",
        psychBackground: selectedBlock.psychBackground || "",
        psychUrls:
          (Array.isArray(selectedBlock.psychUrls) && selectedBlock.psychUrls.length
            ? selectedBlock.psychUrls
            : ["", "", ""]),
        psychLanguage: selectedBlock.psychLanguage || "English",
      }));
      setFormVisible(true);
    }
  }, [selectedBlock]);

  const handleCancel = () => {
    if (selectedBlock) {
      setFormData((prev) => ({
        ...prev,
        title: selectedBlock.blockName || "",
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
        meetingStart: "",
        meetingDuration: "15",
        meetingEnd: "",
        guestEmail: "",
        meetingLink: "",
        psychBackground: selectedBlock.psychBackground || "",
        psychUrls:
          (Array.isArray(selectedBlock.psychUrls) && selectedBlock.psychUrls.length
            ? selectedBlock.psychUrls
            : ["", "", ""]),
        psychLanguage: selectedBlock.psychLanguage || "English",
      }));
    }
    setIsEditing(false);
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  // URL list handlers
  const handleUrlChange = (idx, value) => {
    setFormData((prev) => {
      const next = Array.isArray(prev.psychUrls) ? [...prev.psychUrls] : ["", "", ""];
      next[idx] = value;
      return { ...prev, psychUrls: next };
    });
  };
  const addUrl = () => setFormData((prev) => ({ ...prev, psychUrls: [...prev.psychUrls, ""] }));
  const removeUrl = (idx) =>
    setFormData((prev) => {
      const next = [...prev.psychUrls];
      next.splice(idx, 1);
      return { ...prev, psychUrls: next.length ? next : [""] };
    });

  const handleSave = async () => {
    try {
      if (!formData.title) formData.title = "Untitled Meeting";

      const payloadMeeting = {
        blockName: formData.title,
        userNameAndRole: formData.userName || "",
        userCompanyName: formData.userCompanyName || "",
        userCompanyServices: formData.userCompanyServices || "",
        prospectName: formData.prospectName || "",
        customerCompanyName: formData.customerCompanyName || "",
        customerCompanyServices: formData.customerCompanyServices || "",
        meetingGoal: formData.meetingGoal || "",
        meetingEmail: formData.meetingEmail || "",
        meetingMessage: formData.meetingMessage || "",
        meetingNote: formData.meetingNote || "",
        meetingStart: formData.meetingStart || "",
        meetingDuration: formData.meetingDuration || "15",
        meetingEnd: formData.meetingEnd || "",
        meetingLink: formData.meetingLink || "",
        eventId: formData.eventId || "",
        guestEmail: formData.guestEmail || "",
        createdAt: selectedBlock ? selectedBlock.createdAt : new Date().toISOString(),
        // merged Step 1 data
        psychBackground: formData.psychBackground || "",
        psychUrls: (formData.psychUrls || []).map((u) => u.trim()).filter(Boolean),
        psychLanguage: formData.psychLanguage || "English",
      };

      if (selectedBlock) {
        chrome.runtime.sendMessage(
          {
            type: "UPDATE_MEETING_PREPARE",
            payload: {
              email: decodedCookieEmail,
              meetingId: selectedBlock._id || selectedBlock.id,
              payload: payloadMeeting,
            },
          },
          (res) => {
            if (res?.error) alert("Update failed: " + res.error);
            else {
              alert("Update successful");
              refreshBlocks();
            }
          }
        );
      } else {
        chrome.runtime.sendMessage(
          {
            type: "CREATE_MEETING_PREPARE",
            payload: { email: decodedCookieEmail, payload: payloadMeeting },
          },
          (response) => {
            if (response?.error) console.error("Create error:", response.error);
            else {
              refreshBlocks();
              setFormVisible(false);
              setSelectedBlock(null);
            }
          }
        );
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleDeleteBlock = (block) => {
    if (!window.confirm("Are you sure you want to delete this meeting?")) return;
    chrome.runtime.sendMessage(
      {
        type: "DELETE_MEETING_PREPARE",
        payload: { email: decodedCookieEmail, meetingId: block._id || block.id },
      },
      (res) => {
        if (res?.error) alert("Delete failed: " + res.error);
        else {
          alert("Meeting deleted successfully");
          setSelectedBlock(null);
          setFormVisible(false);
          refreshBlocks();
        }
      }
    );
  };

  const refreshBlocks = () => {
    if (!decodedCookieEmail) return;
    chrome.runtime.sendMessage(
      { type: "GET_MEETING_PREPARE", payload: { email: decodedCookieEmail } },
      (res2) => {
        if (res2?.data?.meeting?.meetings) {
          const meetings = res2.data.meeting.meetings;
          setBlocks(
            meetings.map((m) => ({
              id: m._id?.$oid || m._id || m.id,
              name: m.blockName,
              ...m,
            }))
          );
        } else setBlocks([]);
      }
    );
  };

  useEffect(() => {
    if (!decodedCookieEmail) return;
    chrome.runtime.sendMessage(
      { type: "GET_MEETING_PREPARE", payload: { email: decodedCookieEmail } },
      (res) => {
        if (res?.data?.meeting?.meetings) {
          const meetings = res.data.meeting.meetings;
          setBlocks(
            meetings.map((m) => ({
              id: m._id?.$oid || m._id || m.id,
              name: m.blockName,
              ...m,
            }))
          );
        } else setBlocks([]);
      }
    );
  }, [decodedCookieEmail]);

  useEffect(() => {
    if (!formData.meetingStart) return;
    const startDate = new Date(formData.meetingStart);
    if (isNaN(startDate.getTime())) return;
    const duration = parseInt(formData.meetingDuration, 10) || 30;
    const endDate = new Date(startDate.getTime() + duration * 60000);
    setFormData((prev) => ({ ...prev, meetingEnd: endDate.toISOString() }));
  }, [formData.meetingStart, formData.meetingDuration]);

  const handleCreateNew = () => {
    setSelectedBlock(null);
    setFormData({
      title: "",
      userName: "",
      userCompanyName: "",
      userCompanyServices: "",
      prospectName: "",
      customerCompanyName: "",
      customerCompanyServices: "",
      meetingGoal: "",
      meetingEmail: "",
      meetingMessage: "",
      meetingNote: "",
      psychBackground: "",
      psychUrls: ["", "", ""],
      psychLanguage: "English",
    });
    setFormVisible(true);
    setIsEditing(true);
  };

  const handleStart = () => {
    chrome.runtime.sendMessage(
      {
        type: "USE_ADDON_SESSION",
        payload: {
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent",
        },
      },
      (data) => {
        chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
          chrome.runtime.sendMessage({ type: "START_TIMER" });
        });
        if (data?.data?.trial_used === true || data?.data?.status === "200") {
          onStartMeeting({
            ...formData,
            id: selectedBlock?.id,
            _id: selectedBlock?.id,
          });
        } else {
          alert("You have run out of sessions. Please purchase an add-on to continue.");
        }
      }
    );
  };

  // Build payload for background analyzers
  const buildAnalyzerPayload = () => {
    let personaProfile = "";
    try {
      personaProfile = localStorage.getItem(LS_PERSONA_KEY) || "";
    } catch {}
    return {
      username: decodedCookieEmail || "",
      name: formData.prospectName?.trim() || "",
      biography: formData.psychBackground?.trim() || "",
      language: formData.psychLanguage?.trim() || "English",
      socialMediaUrl: (formData.psychUrls || [])
        .map((u) => (u || "").trim())
        .filter(Boolean)
        .map((u) => ({ socialMediaUrl: u })),
      query: { firstChat: false, continue: false, content: "" },
      msg: [],
      psychographic_profile: personaProfile,
      context: {
        userNameAndRole: formData.userName,
        userCompanyName: formData.userCompanyName,
        userCompanyServices: formData.userCompanyServices,
        customerCompanyName: formData.customerCompanyName,
        customerCompanyServices: formData.customerCompanyServices,
        meetingGoal: formData.meetingGoal,
      },
    };
  };

  // Format helper for modal sections
  const fmt = (title, body) => `\n[${title}]\n${body}\n`;

  // Generate → call background APIs based on checkboxes, then show modal with results
  const handleGenerate = () => {
    if (!runBusinessDNA && !runPsych) {
      alert("Please select at least one option to generate.");
      return;
    }
    setGenerating(true);

    const payload = buildAnalyzerPayload();
    const chunks = [];

    const pushFromResponse = (title, res) => {
      if (chrome.runtime.lastError) {
        chunks.push(fmt(title, `Error: ${chrome.runtime.lastError.message || "Runtime error"}`));
        return;
      }
      if (!res?.ok) {
        const msg =
          typeof res?.data === "string" ? res.data : res?.status ? `HTTP ${res.status}` : "Request failed.";
        chunks.push(fmt(title, `Error: ${msg}`));
        return;
      }
      const data = res.data;
      const text =
        typeof data === "string"
          ? data
          : data?.content
          ? String(data.content)
          : JSON.stringify(data, null, 2);
      chunks.push(fmt(title, text));
    };

    const tasks = [];

    if (runPsych) {
      tasks.push(
        new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SALE_PROSPECT_REQUEST", payload },
            (res) => {
              pushFromResponse("AI Psych Analyzer", res);
              resolve();
            }
          );
        })
      );
    }

    if (runBusinessDNA) {
      tasks.push(
        new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "BUSINESS_DNA_REQUEST", payload }, // background.js needs to handle this
            (res) => {
              pushFromResponse("AI BusinessDNA", res);
              resolve();
            }
          );
        })
      );
    }

    Promise.all(tasks)
      .then(() => {
        const combined = chunks.join("").trim() || "No content returned.";
        // save into note as well
        setFormData((prev) => ({
          ...prev,
          meetingNote: (prev.meetingNote || "") + "\n" + combined,
        }));
        // open modal with editable content
        setModalText(combined);
        setModalOpen(true);
      })
      .finally(() => setGenerating(false));
  };

  return (
    <div className="popup-with-sidebar">
      <div className={`sidebar-wrapper ${sidebarVisible ? "" : "hidden"}`}>
        <SideBar
          blocks={blocks}
          onViewBlock={(block) => {
            setSelectedBlock(block);
            setIsEditing(false);
            setFormVisible(true);
          }}
          onEditBlock={(block) => {
            setSelectedBlock(block);
            setIsEditing(true);
            setFormVisible(true);
          }}
          onDeleteBlock={handleDeleteBlock}
          onCreateNew={handleCreateNew}
          setSidebarVisible={setSidebarVisible}
        />
      </div>

      <button
        className={`sidebar-toggle ${sidebarVisible ? "expanded" : "collapsed"}`}
        onClick={() => setSidebarVisible((v) => !v)}
      >
        {sidebarVisible ? "<" : ">"}
      </button>

      <div className="form-wrapper">
        {!formVisible ? (
          <div className="form-placeholder">
            <InboxOutlined className="icon-inbox" />
            <p className="form-placeholder-text">
              Click View from the sidebar item to start the meeting
            </p>
          </div>
        ) : (
          <>
            <div className="section-title"></div>
            {formData.meetingLink && (
              <div className="meeting-link">
                <a href={formData.meetingLink} target="_blank" rel="noopener noreferrer">
                  {formData.meetingLink}
                </a>
              </div>
            )}

            {/* Step 2 */}
            <CollapsibleSection
              step={2}
              title="Step 2: Meeting Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <InputField
                id="title"
                label="Title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                placeholder="Meeting Title"
                error={errors.title}
                readOnly={!isEditing}
              />
              <GoogleCalendar
                formData={formData}
                handleChange={handleChange}
                error={errors}
                onSaveWithCalendar={handleSave}
                readOnly={!isEditing}
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                setOpenSections={setOpenSections}
              />
            </CollapsibleSection>

            {/* Step 3 */}
            <CollapsibleSection
              step={3}
              title="Step 3: User A – Your Info"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <InputField
                id="userName"
                label="Your Name and Role/Title:"
                type="text"
                value={formData.userName}
                onChange={handleChange}
                placeholder="Your Name and Role/Title:"
                error={errors.userName}
                readOnly={!isEditing}
              />
              <InputField
                id="userCompanyName"
                label="Your Company Name"
                type="text"
                value={formData.userCompanyName}
                onChange={handleChange}
                placeholder="Your Company Name"
                error={errors.userCompanyName}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="userCompanyServices"
                label="Your Company – Industry, Products, and Services"
                placeholder="Please provide clear information about your company, including Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />
            </CollapsibleSection>

            {/* Step 4 */}
            <CollapsibleSection
              step={4}
              title="Step 4: User B – Prospect Info"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <InputField
                id="prospectName"
                label="Prospect's Name - Role/Title"
                type="text"
                value={formData.prospectName}
                onChange={handleChange}
                placeholder="Prospect's Name - Role/Title"
                error={errors.prospectName}
                readOnly={!isEditing}
              />
              <InputField
                id="customerCompanyName"
                label="Prospect Company Name"
                type="text"
                placeholder="Prospect Company Name"
                value={formData.customerCompanyName}
                onChange={handleChange}
                error={errors.customerCompanyName}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="customerCompanyServices"
                label="Prospect Company – Industry, Products, Services"
                placeholder="Please provide clear information about your prospect company, including its Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />

              {/* Background */}
              <InputField
                id="psychBackground"
                label="Background (Copy of LinkedIn CV or detailed Bio)"
                type="text"
                value={formData.psychBackground}
                onChange={handleChange}
                placeholder="Paste LinkedIn summary or detailed bio here..."
                error={errors.psychBackground}
                readOnly={!isEditing}
              />

              {/* URLs list */}
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  URLs (Website / LinkedIn / Other)
                </div>
                {formData.psychUrls.map((u, idx) => (
                  <div
                    key={idx}
                    style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}
                  >
                    <InputField
                      id={`psychUrl_${idx}`}
                      label={null}
                      type="url"
                      value={u}
                      onChange={(e) => handleUrlChange(idx, e.target.value)}
                      placeholder="https://..."
                      readOnly={!isEditing}
                    />
                    {isEditing && (
                      <button
                        type="button"
                        className="bm-btn bm-btn--ghost"
                        onClick={() => removeUrl(idx)}
                        style={{ height: 36 }}
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
                {isEditing && (
                  <button
                    type="button"
                    className="bm-btn bm-btn--ghost"
                    onClick={addUrl}
                    style={{ marginTop: 6 }}
                  >
                    + Add URL
                  </button>
                )}
              </div>

              {/* Language (optional) */}
              <InputField
                id="psychLanguage"
                label="Language"
                type="text"
                value={formData.psychLanguage}
                onChange={handleChange}
                placeholder="e.g., English"
                error={errors.psychLanguage}
                readOnly={!isEditing}
              />

              {/* Checkboxes + Generate button */}
              <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={runBusinessDNA}
                    onChange={(e) => setRunBusinessDNA(e.target.checked)}
                  />
                  <span>AI BusinessDNA</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={runPsych}
                    onChange={(e) => setRunPsych(e.target.checked)}
                  />
                  <span>AI Psych Analyzer</span>
                </label>

                <button
                  type="button"
                  className="bm-btn bm-btn--primary"
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ marginLeft: "auto" }}
                >
                  {generating ? "Generating..." : "Generate"}
                </button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              step={5}
              title="Step 5: Contextual Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <ExpandableTextarea
                id="meetingGoal"
                label="Meeting Goal"
                placeholder="Describe your objective clearly (e.g., secure a partnership, schedule a demo, explore collaboration, close a sale)."
                maxRows={5}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="meetingEmail"
                label="Email (Optional)"
                placeholder="Copy and paste the entire email thread with the prospect, including your initial outreach"
                maxRows={5}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="meetingMessage"
                label="Social Media Message History (Optional)"
                placeholder="Copy and paste any relevant social media conversations (e.g., LinkedIn, Twitter) with the prospect. (Optional)"
                maxRows={5}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="meetingNote"
                label="Note (Optional)"
                placeholder="For example, additional information useful for the Agent, such as personality analysis results, BusinessDNA insights, key pain points, potential objections, and relationship history with the prospect, etc."
                maxRows={5}
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />
            </CollapsibleSection>
          </>
        )}
        {formVisible && (
          <div className="form-actions">
            <button className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
            {!selectedBlock ? (
              <button className="save-button" onClick={handleSave}>
                Save
              </button>
            ) : isEditing ? (
              <button className="edit-button" onClick={handleSave}>
                Update
              </button>
            ) : (
              <button className="start-button" onClick={handleStart}>
                Start
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result Modal */}
      <ResultModal
        open={modalOpen}
        title="Generated Results (Editable)"
        value={modalText}
        setValue={setModalText}
        onClose={() => setModalOpen(false)}
        onCopy={() => navigator.clipboard?.writeText(modalText).catch(() => {})}
        onSaveToNote={() => {
          setFormData((prev) => ({
            ...prev,
            meetingNote: (prev.meetingNote || "") + `\n\n[Edited Results]\n${modalText}`,
          }));
          setModalOpen(false);
        }}
      />
    </div>
  );
}
