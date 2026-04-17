// src/components/PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import SideBar from "./Sidebar";
import InboxOutlined from "../assets/InboxOutlined.svg?react";
import InputField from "./InputField";
import GoogleCalendar from "./GoogleCalendar";
import ExpandableTextarea from "./ExpandableTextarea";
import CollapsibleSection from "./CollapsibleSection";
import ResultModal from "./ResultModal";
import ResultBlock from "./ResultBlock";
import AIPsychAnalyzerStep from "./AIPsychAnalyzerStep";
import { signInAndGetCalendarToken } from "../api/authGoogleCalendar"; // 👈 thêm

const LS_PERSONA_KEY = "bm.persona_profile";
const DEFAULT_AGENT_MODEL_KEY = "groq";
const AGENT_MODEL_OPTIONS = [
  {
    key: "groq",
    label: "Groq",
    meta: "Fastest default",
  },
  {
    key: "gemini",
    label: "Gemini",
    meta: "Stable quality",
  },
  {
    key: "kimi",
    label: "Kimi",
    meta: "Moonshot route",
  },
];

export default function PopupWithSidebar({
  onStartMeeting,
  onSelectBlock,
  decodedCookieEmail,
}) {
  const [blocks, setBlocks] = useState([]);
  const [tempBlocks, setTempBlocks] = useState([]); // các block tạm từ kết quả agent
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    userName: "",
    userCompanyName: "",
    userCompanyServices: "",
    userCompanyWebsite: "",
    userKeyCompanyUrls: ["", "", ""],
    prospectName: "",
    customerCompanyName: "",
    customerCompanyServices: "",
    prospectCompanyWebsite: "",
    meetingGoal: "",
    meetingEmail: "",
    meetingMessage: "",
    meetingNote: "",
    agentModelKey: DEFAULT_AGENT_MODEL_KEY,
    meetingStart: "",
    designatedTime: "",
    meetingDuration: "15",
    meetingEnd: "",
    guestEmail: "",
    meetingLink: "",
    psychBackground: "",
    psychUrls: ["", "", ""],
    psychLanguage: "English",
    psychAnalyzerResult: "",
    businessDNAResult: "",
    conversionArchitectDossier: "",
    meetingTranscript: "",
  });
  const [errors, setErrors] = useState({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [openSections, setOpenSections] = useState([1]);

  const [runBusinessDNA, setRunBusinessDNA] = useState(false);
  const [runPsych, setRunPsych] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Modal queue
  const [modalQueue, setModalQueue] = useState([]); // [{ key:'psych'|'bdna', label, text }]
  const [modalIdx, setModalIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  // Staged results (đợi user bấm Save trong modal, sẽ tạo block tạm và lưu DB khi handleSave)
  const [stagedResults, setStagedResults] = useState({ psych: "", bdna: "" });

  const imgUrlPsychAnalyzer = chrome.runtime.getURL("images/prospect.jpg");
  const imgUrlBussinessDNA = chrome.runtime.getURL("images/business_dna.jpg");
  const [toolHistoryOptions, setToolHistoryOptions] = useState([]);
  const [selectedToolHistory, setSelectedToolHistory] = useState("");
  const [showDossier, setShowDossier] = useState(false);
  const [brandDNA, setBrandDNA] = useState("");
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "GET_TOOL_HISTORY" },
      (res) => {
        if (res?.ok) {
          setToolHistoryOptions(res.data || []);
        } else {
          setToolHistoryOptions([]);
        }
      }
    );
  }, []);
  const fetchBrandDNA = () => {
    chrome.runtime.sendMessage(
      {
        type: "GET_BRAND_DNA",
        payload: { username: decodedCookieEmail },
      },
      (res) => {
        if (!res?.ok) {
          console.error("❌ Get BrandDNA failed:", res);
          return;
        }

        const data = res.data;

        // tuỳ BE trả array hay object
        let content = "";

        if (Array.isArray(data) && data.length > 0) {
          content = JSON.stringify(data[0], null, 2);
        } else if (typeof data === "object") {
          content = JSON.stringify(data, null, 2);
        } else {
          content = String(data);
        }

        setBrandDNA(content);

        // 🔥 quan trọng: merge vào formData KHÔNG overwrite
        setFormData((prev) => ({
          ...prev,
          businessDNAResult:
            prev.businessDNAResult && prev.businessDNAResult.trim()
              ? prev.businessDNAResult
              : content,
        }));
      }
    );
  };
  useEffect(() => {
    if (!decodedCookieEmail) return;

    // chỉ load lần đầu
    if (brandDNA && brandDNA.trim()) return;

    fetchBrandDNA();
  }, [decodedCookieEmail, brandDNA]);

  useEffect(() => {
    if (!selectedBlock) return;
    setStagedResults({
      psych: selectedBlock?.psychAnalyzerResult || "",
      bdna: selectedBlock?.businessDNAResult || "",
    });
  }, [selectedBlock]);

  const openModalFor = (key) => {
    const label = key === "psych" ? "AI Psych Analyzer" : "AI BusinessDNA";
    const text = key === "psych" ? stagedResults.psych : stagedResults.bdna;
    setModalQueue([{ key, label, text }]);
    setModalIdx(0);
    setModalOpen(true);
  };

  useEffect(() => {
    if (selectedBlock) {
            const dossier =
  selectedBlock.conversionArchitectDossier ||
  selectedBlock.conversion_architect_dossier ||
  "";
      setFormData((prev) => ({
        ...prev,
        title: selectedBlock.blockName || "",
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        userCompanyWebsite: selectedBlock.userCompanyWebsite || "",
        userKeyCompanyUrls:
          Array.isArray(selectedBlock.userKeyCompanyUrls) &&
            selectedBlock.userKeyCompanyUrls.length
            ? selectedBlock.userKeyCompanyUrls
            : ["", "", ""],
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        prospectCompanyWebsite: selectedBlock.prospectCompanyWebsite || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
        agentModelKey:
          selectedBlock.agentModelKey || DEFAULT_AGENT_MODEL_KEY,
        meetingStart: selectedBlock.meetingStart || "",
        meetingDuration: selectedBlock.meetingDuration || "15",
        meetingEnd: selectedBlock.meetingEnd || "",
        guestEmail: selectedBlock.guestEmail || "",
        meetingLink: selectedBlock.meetingLink || "",
        psychBackground: selectedBlock.psychBackground || "",
        psychUrls:
          Array.isArray(selectedBlock.psychUrls) && selectedBlock.psychUrls.length
            ? selectedBlock.psychUrls
            : ["", "", ""],
        psychLanguage: selectedBlock.psychLanguage || "English",
        psychAnalyzerResult: selectedBlock.psychAnalyzerResult || "",
        businessDNAResult:
          selectedBlock.businessDNAResult ||
          brandDNA || // 🔥 fallback từ auto load
          "",
        conversionArchitectDossier: dossier,
        meetingTranscript:
          selectedBlock.meeting_transcript ||
          selectedBlock.meetingTranscript ||
          "",
        designatedTime: selectedBlock.designatedTime || "",

        eventId: selectedBlock.eventId || "",
      }));


setShowDossier(!!dossier);
      setFormVisible(true);
      
    }
  }, [selectedBlock]);

  const handleCancel = () => {
    if (selectedBlock) {
      const dossier =
  selectedBlock.conversionArchitectDossier ||
  selectedBlock.conversion_architect_dossier ||
  "";
      setFormData((prev) => ({
        ...prev,
        title: selectedBlock.blockName || "",
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        userCompanyWebsite: selectedBlock.userCompanyWebsite || "",
        userKeyCompanyUrls:
          Array.isArray(selectedBlock.userKeyCompanyUrls) &&
            selectedBlock.userKeyCompanyUrls.length
            ? selectedBlock.userKeyCompanyUrls
            : ["", "", ""],
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        prospectCompanyWebsite: selectedBlock.prospectCompanyWebsite || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
        agentModelKey:
          selectedBlock.agentModelKey || DEFAULT_AGENT_MODEL_KEY,
        meetingStart: "",
        designatedTime: selectedBlock.designatedTime || "",
        meetingDuration: "15",
        meetingEnd: "",
        guestEmail: "",
        meetingLink: "",
        psychBackground: selectedBlock.psychBackground || "",
        psychUrls:
          Array.isArray(selectedBlock.psychUrls) && selectedBlock.psychUrls.length
            ? selectedBlock.psychUrls
            : ["", "", ""],
        psychLanguage: selectedBlock.psychLanguage || "English",
        psychAnalyzerResult: selectedBlock.psychAnalyzerResult || "",
        businessDNAResult: selectedBlock.businessDNAResult || "",
        conversionArchitectDossier:dossier ,
        meetingTranscript:
          selectedBlock.meeting_transcript ||
          selectedBlock.meetingTranscript ||
          "",
        eventId: selectedBlock.eventId || "",
      }));
    }
    setIsEditing(false);
    setShowDossier(!!dossier);
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleUrlChange = (idx, value) => {
    setFormData((prev) => {
      const next = Array.isArray(prev.psychUrls)
        ? [...prev.psychUrls]
        : ["", "", ""];
      next[idx] = value;
      return { ...prev, psychUrls: next };
    });
  };
  const addUrl = () =>
    setFormData((prev) => ({
      ...prev,
      psychUrls: [...prev.psychUrls, ""],
    }));
  const removeUrl = (idx) =>
    setFormData((prev) => {
      const next = [...prev.psychUrls];
      next.splice(idx, 1);
      return { ...prev, psychUrls: next.length ? next : [""] };
    });

  const handleKeyCompanyUrlChange = (idx, value) => {
    setFormData((prev) => {
      const next = Array.isArray(prev.userKeyCompanyUrls)
        ? [...prev.userKeyCompanyUrls]
        : ["", "", ""];
      next[idx] = value;
      return { ...prev, userKeyCompanyUrls: next };
    });
  };
  const addKeyCompanyUrl = () =>
    setFormData((prev) => ({
      ...prev,
      userKeyCompanyUrls: [...prev.userKeyCompanyUrls, ""],
    }));
  const removeKeyCompanyUrl = (idx) =>
    setFormData((prev) => {
      const next = [...prev.userKeyCompanyUrls];
      next.splice(idx, 1);
      return { ...prev, userKeyCompanyUrls: next.length ? next : [""] };
    });

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
      userCompanyWebsite: "",
      userKeyCompanyUrls: ["", "", ""],
      prospectName: "",
      customerCompanyName: "",
      customerCompanyServices: "",
      prospectCompanyWebsite: "",
      meetingGoal: "",
      designatedTime: "",

      meetingEmail: "",
      meetingMessage: "",
      meetingNote: "",
      agentModelKey: DEFAULT_AGENT_MODEL_KEY,
      meetingStart: "",
      meetingDuration: "15",
      meetingEnd: "",
      guestEmail: "",
      meetingLink: "",
      psychBackground: "",
      psychUrls: ["", "", ""],
      psychLanguage: "English",
      psychAnalyzerResult: "",
      businessDNAResult: "",
      conversionArchitectDossier: "",
      meetingTranscript: "",
      eventId: "",
    });
    setFormVisible(true);
    setIsEditing(true);
  };


  function extractCognitiveTone(brandDNA) {
    try {
      const parsed =
        typeof brandDNA === "string" ? JSON.parse(brandDNA) : brandDNA;

      return parsed?.cognitive_clone_tone || "";
    } catch {
      return "";
    }
  }
  const handleArchiveDossier = () => {
    console.log("==== START ARCHIVE DOSSIER ====");

    console.log("selectedToolHistory:", selectedToolHistory);
    console.log("toolHistoryOptions:", toolHistoryOptions);

    const selectedHistory = toolHistoryOptions.find(
      (item) => item._id === selectedToolHistory
    );

    console.log("selectedHistory:", selectedHistory);

    if (!selectedHistory) {
      console.error("❌ Không tìm thấy selectedHistory");
      alert("Please select tool history");
      return;
    }

    let parsedResult = {};

    try {
      console.log("raw result:", selectedHistory.result);
      console.log("typeof result:", typeof selectedHistory.result);

      parsedResult =
        typeof selectedHistory.result === "string"
          ? JSON.parse(selectedHistory.result)
          : selectedHistory.result || {};

      console.log("✅ parsedResult:", parsedResult);
    } catch (e) {
      console.error("❌ Parse result error:", e);
    }

    const architectMessages = parsedResult?.architectMessages || [];

    console.log("architectMessages:", architectMessages);
    console.log("architectMessages length:", architectMessages.length);

    const rawConversation = architectMessages
      .map((m, idx) => {
        console.log(`msg[${idx}]:`, m);
        return `${m.role}: ${m.content}`;
      })
      .join("\n");

    console.log("rawConversation:", rawConversation);

    const existingDossier = {
      psych: parsedResult?.dossier?.psych || "",
      business: parsedResult?.dossier?.business || "",
    };

    console.log("existingDossier:", existingDossier);

    if (!rawConversation) {
      console.error("❌ rawConversation empty");
      alert("No conversation history found");
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "ARCHIVE_CONVERSATION",
        payload: {
          raw_conversation_history: rawConversation,
          existing_dossier: existingDossier,
        },
      },
      (res) => {
        console.log("response:", res);

        if (!res?.ok) {
          console.error("❌ Archive failed:", res);
          alert("Archive failed");
          return;
        }

        const data = res.data?.content;

        console.log("✅ archive data:", data);

        setFormData((prev) => ({
          ...prev,
          conversionArchitectDossier: JSON.stringify(data, null, 2),
        }));
        setShowDossier(true);
      }
    );
  };

  const handleStart = () => {
    const cognitiveTone = extractCognitiveTone(brandDNA);
    console.log("brandDNA RAW:", brandDNA);
    console.log("cognitiveTone:", cognitiveTone);
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
        if (
          data?.data?.trial_used === true ||
          data?.data?.status === "200"
        ) {
          onStartMeeting({
            ...formData,
            cognitive_clone_tone: cognitiveTone,
            id: selectedBlock?.id,
            _id: selectedBlock?.id,
          });
        } else {
          alert(
            "You have run out of sessions. Please purchase an add-on to continue."
          );
        }
      }
    );
  };

  // ===== Payload builders =====
  const buildPsychPayload = () => {
    let personaProfile = "";
    try {
      personaProfile = localStorage.getItem(LS_PERSONA_KEY) || "";
    } catch { }
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

  const buildBusinessDnaPayload = () => {
    return {
      query: { firstChat: false, continue: false, content: "" },
      msg: [],
      nameOfBusiness: formData.userCompanyName?.trim() || "",
      typeOfBusiness: formData.userCompanyServices?.trim() || "",
      companyUrl: formData.userCompanyWebsite?.trim() || "",
      countryOrRegion: "",
      socialMediaUrl: (formData.userKeyCompanyUrls || [])
        .map((u) => (u || "").trim())
        .filter(Boolean)
        .map((u) => ({ socialMediaUrl: u })),
      prospectName:
        formData.customerCompanyName?.trim() ||
        formData.prospectName?.trim() ||
        "",
      prospectURL: formData.prospectCompanyWebsite?.trim() || "",
      prospectSocialURL: (formData.psychUrls || [])
        .map((u) => (u || "").trim())
        .filter(Boolean)
        .map((u) => ({ prospectSocialURL: u })),
      username: decodedCookieEmail || "",
    };
  };

  // Generate -> HIỂN THỊ MODAL THEO QUEUE, KHÔNG GỘP
  const handleGenerate = () => {
    if (!runBusinessDNA && !runPsych) {
      alert("Please select at least one option to generate.");
      return;
    }
    setGenerating(true);

    const results = [];
    const tasks = [];

    if (runPsych) {
      const payloadPsych = buildPsychPayload();
      tasks.push(
        new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SALE_PROSPECT_REQUEST", payload: payloadPsych },
            (res) => {
              let text;
              if (chrome.runtime.lastError) {
                text = `Error: ${chrome.runtime.lastError.message || "Runtime error"
                  }`;
              } else if (!res?.ok) {
                const msg =
                  typeof res?.data === "string"
                    ? res.data
                    : res?.status
                      ? `HTTP ${res.status}`
                      : "Request failed.";
                text = `Error: ${msg}`;
              } else {
                const data = res.data;
                text =
                  typeof data === "string"
                    ? data
                    : data?.content
                      ? String(data.content)
                      : JSON.stringify(data, null, 2);
              }
              results.push({ key: "psych", label: "AI Psych Analyzer", text });
              resolve();
            }
          );
        })
      );
    }

    if (runBusinessDNA) {
      const payloadDNA = buildBusinessDnaPayload();
      tasks.push(
        new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: "BUSINESS_DNA_REQUEST", payload: payloadDNA },
            (res) => {
              let text;
              if (chrome.runtime.lastError) {
                text = `Error: ${chrome.runtime.lastError.message || "Runtime error"
                  }`;
              } else if (!res?.ok) {
                const msg =
                  typeof res?.data === "string"
                    ? res.data
                    : res?.status
                      ? `HTTP ${res.status}`
                      : "Request failed.";
                text = `Error: ${msg}`;
              } else {
                const data = res.data;
                text =
                  typeof data === "string"
                    ? data
                    : data?.content
                      ? String(data.content)
                      : JSON.stringify(data, null, 2);
              }
              results.push({ key: "bdna", label: "AI BusinessDNA", text });
              resolve();
            }
          );
        })
      );
    }

    Promise.all(tasks)
      .then(() => {
        if (!results.length) {
          alert("No content returned.");
          return;
        }
        setModalQueue(results);
        setModalIdx(0);
        setModalOpen(true);
      })
      .finally(() => setGenerating(false));
  };

  // ===== SAVE MEETING: LƯU THÊM TRƯỜNG psychAnalyzerResult & businessDNAResult =====
  const handleSave = async () => {
    try {
      if (!formData.title) formData.title = "Untitled Meeting";

      const payloadMeeting = {
        blockName: formData.title,
        userNameAndRole: formData.userName || "",
        userCompanyName: formData.userCompanyName || "",
        userCompanyServices: formData.userCompanyServices || "",
        userCompanyWebsite: formData.userCompanyWebsite || "",
        userKeyCompanyUrls: (formData.userKeyCompanyUrls || [])
          .map((u) => u.trim())
          .filter(Boolean),
        prospectName: formData.prospectName || "",
        customerCompanyName: formData.customerCompanyName || "",
        customerCompanyServices: formData.customerCompanyServices || "",
        prospectCompanyWebsite: formData.prospectCompanyWebsite || "",
        meetingGoal: formData.meetingGoal || "",
        meetingEmail: formData.meetingEmail || "",
        meetingMessage: formData.meetingMessage || "",
        meetingNote: formData.meetingNote || "",
        agentModelKey: formData.agentModelKey || DEFAULT_AGENT_MODEL_KEY,
        agentModelLabel:
          AGENT_MODEL_OPTIONS.find(
            (option) => option.key === formData.agentModelKey
          )?.label || "Groq",
        meetingStart: formData.meetingStart || "",
        meetingDuration: formData.meetingDuration || "15",
        meetingEnd: formData.meetingEnd || "",
        meetingLink: formData.meetingLink || "",
        eventId: formData.eventId || "",
        guestEmail: formData.guestEmail || "",
        createdAt: selectedBlock
          ? selectedBlock.createdAt
          : new Date().toISOString(),
        psychBackground: formData.psychBackground || "",
        psychUrls: (formData.psychUrls || [])
          .map((u) => u.trim())
          .filter(Boolean),
        psychLanguage: formData.psychLanguage || "English",
        psychAnalyzerResult:
          formData.psychAnalyzerResult || stagedResults.psych || "",
        businessDNAResult:
          formData.businessDNAResult || stagedResults.bdna || "",
        conversionArchitectDossier:
          formData.conversionArchitectDossier || "",
        conversion_architect_dossier:
          formData.conversionArchitectDossier || "",
        meeting_transcript: formData.meetingTranscript || "",
        designatedTime: formData.designatedTime || "",

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
              setTempBlocks([]); // clear block tạm
              setStagedResults({ psych: "", bdna: "" });
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
            if (response?.error) {
              console.error("Create error:", response.error);
            } else {
              setTempBlocks([]);
              setStagedResults({ psych: "", bdna: "" });
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

  // ==== RENDER ====
  const mergedBlocks = [...blocks, ...tempBlocks]; // hiển thị block thật + block tạm

  return (
    <div className="popup-with-sidebar">
      <div className={`sidebar-wrapper ${sidebarVisible ? "" : "hidden"}`}>
        <SideBar
          blocks={mergedBlocks}
          onViewBlock={(block) => {
            if (block?.tempType === "psych" || block?.tempType === "bdna") {
              setModalQueue([
                {
                  key: block.tempType,
                  label: block.name,
                  text: block.resultText || "",
                },
              ]);
              setModalIdx(0);
              setModalOpen(true);
              return;
            }
            setSelectedBlock(block);
            setIsEditing(false);
            setFormVisible(true);
          }}
          onEditBlock={(block) => {
            if (block?.tempType === "psych" || block?.tempType === "bdna") {
              setModalQueue([
                {
                  key: block.tempType,
                  label: block.name,
                  text: block.resultText || "",
                },
              ]);
              setModalIdx(0);
              setModalOpen(true);
              return;
            }
            setSelectedBlock(block);
            setIsEditing(true);
            setFormVisible(true);
          }}
          onDeleteBlock={async (block) => {
            // 1) Block tạm (psych / bdna) -> chỉ xoá local
            if (block?.tempType) {
              setTempBlocks((prev) => prev.filter((b) => b.id !== block.id));
              if (block.tempType === "psych") {
                setStagedResults((r) => ({ ...r, psych: "" }));
              } else if (block.tempType === "bdna") {
                setStagedResults((r) => ({ ...r, bdna: "" }));
              }
              return;
            }

            // 2) Block thật (meeting_prepare) -> hỏi confirm
            if (
              !window.confirm(
                "Are you sure you want to delete this meeting (and its Google Calendar event if exists)?"
              )
            )
              return;

            // 2.1 Xoá event trên Google Calendar nếu có eventId
            if (block.eventId) {
              try {
                const appToken = await signInAndGetCalendarToken();
                if (!appToken) {
                  console.warn(
                    "[PopupWithSidebar] Cannot get app token for calendar, skip calendar delete"
                  );
                } else if (
                  typeof chrome !== "undefined" &&
                  chrome.runtime &&
                  typeof chrome.runtime.sendMessage === "function"
                ) {
                  const resDel = await new Promise((resolve) => {
                    chrome.runtime.sendMessage(
                      {
                        type: "AI_DIALOGUE_CALENDAR_DELETE",
                        app_token: appToken,
                        event_id: block.eventId,
                      },
                      (resp) => {
                        resolve(resp);
                      }
                    );
                  });
                  console.log(
                    "[PopupWithSidebar] calendar delete result:",
                    resDel
                  );
                }
              } catch (err) {
                console.error(
                  "[PopupWithSidebar] delete calendar event failed:",
                  err
                );
                // không chặn xoá meeting_prepare nếu xoá calendar fail
              }
            }

            // 2.2 Xoá meeting_prepare trong DB
            chrome.runtime.sendMessage(
              {
                type: "DELETE_MEETING_PREPARE",
                payload: {
                  email: decodedCookieEmail,
                  meetingId: block._id || block.id,
                },
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
          }}
          onCreateNew={handleCreateNew}
          setSidebarVisible={setSidebarVisible}
        />
      </div>

      <button
        className={`sidebar-toggle ${sidebarVisible ? "expanded" : "collapsed"
          }`}
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
                <a
                  href={formData.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {formData.meetingLink}
                </a>
              </div>
            )}

            {/* Step 1 */}
            <CollapsibleSection
              step={1}
              title="Step 1: Meeting Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <div style={{ marginBottom: 12 }}>
                <div className="text_label">Tool History</div>

                <select
                  value={selectedToolHistory}
                  onChange={(e) => setSelectedToolHistory(e.target.value)}

                >
                  <option value="">Select...</option>

                  {toolHistoryOptions
                    .filter((item) => item.toolName === "Conversion Architect")
                    .map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.title}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                className="bm-btn bm-btn--primary"
                onClick={handleArchiveDossier}
                style={{ marginTop: 8 }}
              >
                Generate Dossier
              </button>
              {formData.conversionArchitectDossier && showDossier && (
                <div style={{ marginTop: 12 }}>
                  <ResultBlock
                    label="Conversion Architect Dossier"
                    content={formData.conversionArchitectDossier}
                    onOpen={() => {
                      setModalQueue([
                        {
                          key: "dossier",
                          label: "Conversion Architect Dossier",
                          text: formData.conversionArchitectDossier,
                        },
                      ]);
                      setModalIdx(0);
                      setModalOpen(true);
                    }}
                    onRemove={() => {
                      setFormData((prev) => ({
                        ...prev,
                        conversionArchitectDossier: "",
                      }));
                      setShowDossier(false);
                    }}
                  />
                </div>
              )}



              {brandDNA && (
                <div style={{ marginTop: 12 }}>
                  <ResultBlock
                    label="Brand DNA (Auto)"
                    content={brandDNA}
                    onOpen={() => {
                      setModalQueue([
                        {
                          key: "brandDNA",
                          label: "Brand DNA",
                          text: brandDNA,
                        },
                      ]);
                      setModalIdx(0);
                      setModalOpen(true);
                    }}
                    onRemove={() => {
                      setBrandDNA("");
                      setFormData((prev) => ({
                        ...prev,
                        businessDNAResult: "",
                      }));
                    }}
                  />
                </div>
              )}

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
              <div className="agent-model-picker">
                <div className="agent-model-picker__label">
                  AI model test routes
                </div>
                <div className="agent-model-picker__subtext">
                  Each button maps to a separate backend endpoint. Groq is set
                  as the fastest default for quick testing.
                </div>
                <div className="agent-model-picker__buttons">
                  {AGENT_MODEL_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`agent-model-button ${formData.agentModelKey === option.key ? "active" : ""
                        }`}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          agentModelKey: option.key,
                        }))
                      }
                    >
                      <span className="agent-model-button__label">
                        {option.label}
                      </span>
                      <span className="agent-model-button__meta">
                        {option.meta}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
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

            {/* Step 2: User A */}
            <CollapsibleSection
              step={2}
              title="Step 2: User A – Your Info"
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
              <InputField
                id="userCompanyWebsite"
                label="Company Website"
                type="url"
                value={formData.userCompanyWebsite}
                onChange={handleChange}
                placeholder="https://your-company.com"
                error={errors.userCompanyWebsite}
                readOnly={!isEditing}
              />
              <div style={{ marginTop: 12 }}>
                <div className="text_label">Your Key Company URLs</div>
                {(formData.userKeyCompanyUrls || []).map((u, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      id={`userKeyCompanyUrl_${idx}`}
                      type="url"
                      value={u}
                      onChange={(e) =>
                        handleKeyCompanyUrlChange(idx, e.target.value)
                      }
                      placeholder="https://..."
                      readOnly={!isEditing}
                      style={{
                        flex: 1,
                        height: 36,
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "8px 12px",
                        outline: "none",
                      }}
                    />
                    {isEditing && (
                      <button
                        type="button"
                        className="bm-btn bm-btn--ghost"
                        onClick={() => removeKeyCompanyUrl(idx)}
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
                    className="bm-btn bm-btn--add_url"
                    onClick={addKeyCompanyUrl}
                    style={{ marginTop: 6 }}
                  >
                    + Add URL
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Step 3: Prospect */}
            <CollapsibleSection
              step={3}
              title="Step 3: User B – Prospect Info"
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
              <InputField
                id="prospectCompanyWebsite"
                label="Company Website"
                type="url"
                value={formData.prospectCompanyWebsite}
                onChange={handleChange}
                placeholder="https://prospect-company.com"
                error={errors.prospectCompanyWebsite}
                readOnly={!isEditing}
              />
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
              <div style={{ marginTop: 12 }}>
                <div className="text_label">
                  URLs (Website / LinkedIn / Other)
                </div>
                {formData.psychUrls.map((u, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <input
                      id={` psychUrl_${idx}`}
                      type="url"
                      value={u}
                      onChange={(e) => handleUrlChange(idx, e.target.value)}
                      placeholder="https://..."
                      readOnly={!isEditing}
                      style={{
                        flex: 1,
                        height: 36,
                        background: "rgba(255, 255, 255, 0.05)",
                        color: "#fff",
                        border: "1px solid #d1d5db",
                        borderRadius: 6,
                        padding: "8px 12px",
                        outline: "none",
                      }}
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
                    className="bm-btn bm-btn--add_url"
                    onClick={addUrl}
                    style={{ marginTop: 6 }}
                  >
                    + Add URL
                  </button>
                )}
              </div>
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

              {(stagedResults.psych || stagedResults.bdna) && (
                <div className="rb-wrap">
                  <p className="label-input">Result</p>
                  {stagedResults.psych && (
                    <ResultBlock
                      label="AI Psych Analyzer"
                      content={stagedResults.psych}
                      onOpen={() => openModalFor("psych")}
                      onRemove={
                        isEditing
                          ? () =>
                            setStagedResults((r) => ({ ...r, psych: "" }))
                          : undefined
                      }
                    />
                  )}
                  {stagedResults.bdna && (
                    <ResultBlock
                      label="AI BusinessDNA"
                      content={stagedResults.bdna}
                      onOpen={() => openModalFor("bdna")}
                      onRemove={
                        isEditing
                          ? () =>
                            setStagedResults((r) => ({ ...r, bdna: "" }))
                          : undefined
                      }
                    />
                  )}
                </div>
              )}

              <AIPsychAnalyzerStep
                className=""
                heroImageSrc={imgUrlPsychAnalyzer}
                heroTitle="AI Psych Analyzer"
                heroDescription="Trained on advanced behavioral models, the AI Psych Analyzer decodes personality traits, motivations, and communication styles—then simulates their mindset."
                checked={runPsych}
                onToggle={(val) => setRunPsych(val)}
              />

              <AIPsychAnalyzerStep
                className=""
                heroImageSrc={imgUrlBussinessDNA}
                heroTitle="AI BusinessDNA"
                heroDescription="AI BusinessDNA analyzes your business model, positioning, and digital footprint to generate a structured, investor-ready and buyer-ready narrative."
                checked={runBusinessDNA}
                onToggle={(val) => setRunBusinessDNA(val)}
              />

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                }}
              >
<button
  type="button"
  className={`bm-btn bm-btn--primary ${generating ? "loading" : ""}`}
  onClick={handleGenerate}
  disabled={generating}
  style={{
    marginLeft: "auto",
    opacity: generating ? 0.7 : 1,
    cursor: generating ? "not-allowed" : "pointer",
  }}
>
  {generating ? (
    <>
      <span className="spinner" /> Generating...
    </>
  ) : (
    "Generate"
  )}
</button>
              </div>
            </CollapsibleSection>

            {/* Step 4 */}
            <CollapsibleSection
              step={4}
              title="Step 4: Contextual Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <InputField
                id="designatedTime"
                label="Designated Time"
                type="text"
                value={formData.designatedTime}
                onChange={handleChange}
                placeholder="e.g., 15 (minutes)"
                error={errors.designatedTime}
                readOnly={!isEditing}
              />

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
              <ExpandableTextarea
                id="conversionArchitectDossier"
                label="Conversion Architect Dossier"
                placeholder="Auto-generated summary from prior meetings. Keep the JSON structure so the Strategist can reuse sentiment, friction, milestones, and narrative arc."
                maxRows={8}
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

      {/* Result Modal (queue by item) */}
      {modalOpen && modalQueue[modalIdx] && (
        <ResultModal
          open={true}
          title={`${modalQueue[modalIdx].label} (${modalIdx + 1
            }/${modalQueue.length})`}
          value={modalQueue[modalIdx].text}
          setValue={(v) => {
            setModalQueue((prev) => {
              const copy = [...prev];
              copy[modalIdx] = { ...copy[modalIdx], text: v };
              return copy;
            });
          }}
          onCopy={() =>
            navigator.clipboard
              ?.writeText(modalQueue[modalIdx].text)
              .catch(() => { })
          }
          onClose={() => {
            setModalOpen(false);
            setModalQueue([]);
            setModalIdx(0);
          }}
          onSave={(content) => {
            if (modalQueue[modalIdx].key === "psych") {
              setStagedResults((r) => ({ ...r, psych: content }));
              setFormData((prev) => ({
                ...prev,
                psychAnalyzerResult: content,
              }));
              setTempBlocks((prev) => {
                const others = prev.filter((b) => b.tempType !== "psych");
                return [
                  ...others,
                  {
                    id: "temp-psych",
                    name: "AI Psych Analyzer",
                    tempType: "psych",
                    resultText: content,
                  },
                ];
              });
            } else if (modalQueue[modalIdx].key === "bdna") {
              setStagedResults((r) => ({ ...r, bdna: content }));
              setFormData((prev) => ({
                ...prev,
                businessDNAResult: content,
              }));
              setTempBlocks((prev) => {
                const others = prev.filter((b) => b.tempType !== "bdna");
                return [
                  ...others,
                  {
                    id: "temp-bdna",
                    name: "AI BusinessDNA",
                    tempType: "bdna",
                    resultText: content,
                  },
                ];
              });
            }
          }}
          onNext={() => {
            if (modalIdx < modalQueue.length - 1) {
              setModalIdx((i) => i + 1);
            } else {
              setModalOpen(false);
              setModalQueue([]);
              setModalIdx(0);
            }
          }}
        />
      )}
    </div>
  );
}
