import React, { useEffect, useState } from "react";
import "../styles/popup.css";
import axios from "axios";
import PopupWithSidebar from "../component/PopupWithSidebar.jsx";

export default function PopupPage({ onStartMeeting, cookieUserName }) {
  const VITE_URL_BACKEND = 'https://api-as.reelsightsai.com'
  const [remainSessions, setRemainSessions] = useState(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    userName: "",
    userCompanyName: "",
    userCompanyServices: "",
    prospectName: "",
    customerCompanyName: "",
    customerCompanyServices: "",
    meetingGoal: "",
    meetingEmail: "",
    meetingMessage: "",
    meetingNote: ""
  });
  const [errors, setErrors] = useState({});
  const decodedCookieEmail = decodeURIComponent(cookieUserName);
  const [tab, setTab] = useState("schedule"); // "instant" | "schedule"

  useEffect(() => {
    const fetchRemainSessions = async () => {
      try {
        const res = await axios.post(
          `${VITE_URL_BACKEND}/api/addons/get_addon_sessions`,
          {
            email: decodedCookieEmail,
            add_on_type: "ai_dialogue_architect_agent",
          }
        );

        if (res.data.status === "200") {
          const { value, trial } = res.data.content;

          if (trial) {
            setRemainSessions(`${value} sessions + Trial`);
          } else {
            setRemainSessions(`${value} sessions`);
          }
        } else {
          setRemainSessions("0 sessions");
        }
      } catch (err) {
        console.error("Error fetching remain sessions:", err);
        setRemainSessions("0 sessions");
      }
    };
    fetchRemainSessions();
  }, [decodedCookieEmail]);

  const sampleBlocks = [

    {
      id: 2,
      name: "Follow-up Call – Client B",
      type: "schedule",
      userName: "Nguyễn Văn A",
      userCompanyName: "TechCorp",
      userCompanyServices: "Software solutions",
      prospectName: "Mai Lan",
      customerCompanyName: "Spa Luxury",
      customerCompanyServices: "Chăm sóc da & làm đẹp",
      meetingGoal: "Bàn kế hoạch hợp tác phần mềm",
      meetingEmail: "nguyenvana@example.com",
      meetingMessage: "Xin chào, muốn follow-up hợp đồng",
      meetingNote: "Cuộc họp follow-up khách hàng"
    },
    {
      id: 3,
      name: "Product Pitch – Client C",
      type: "instant",
      userName: "Trần Thị B",
      userCompanyName: "EduTech",
      userCompanyServices: "Online education platform",
      prospectName: "Hà Nội Spa",
      customerCompanyName: "Hà Nội Spa",
      customerCompanyServices: "Spa & Wellness",
      meetingGoal: "Giới thiệu sản phẩm AI",
      meetingEmail: "tranthib@example.com",
      meetingMessage: "Chào bạn, mình muốn demo sản phẩm AI",
      meetingNote: "Demo nội bộ"
    }
  ];

  const validateStep = () => {
    const newErrors = {};
    if (step === 1) {
      if (!formData.userName.trim()) newErrors.userName = "Required field";
      if (!formData.userCompanyName.trim()) newErrors.userCompanyName = "Required field";
      if (!formData.userCompanyServices.trim()) newErrors.userCompanyServices = "Required field";
    }
    if (step === 2) {
      if (!formData.prospectName.trim()) newErrors.prospectName = "Required field";
      if (!formData.customerCompanyName.trim()) newErrors.customerCompanyName = "Required field";
      if (!formData.customerCompanyServices.trim()) newErrors.customerCompanyServices = "Required field";
    }
    if (step === 3) {
      if (!formData.meetingGoal.trim()) newErrors.meetingGoal = "Required field";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleNext = () => {
    if (validateStep()) setStep(prev => prev + 1);
  };

  const handleBack = () => setStep(prev => prev - 1);

  const handleStart = async () => {
    if (!validateStep()) return;
    try {
      const res = await fetch(`${VITE_URL_BACKEND}/api/addons/use_addon_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent"
        })
      });

      const data = await res.json();

      chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
        chrome.runtime.sendMessage({ type: "START_TIMER" });

      });

      if (data.trial_used === true || data.status === "200") {
        onStartMeeting(formData);
      } else {
        alert("You have run out of sessions. Please purchase an add-on to continue.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while calling the API");
    }
  };

const renderExpandableTextarea = (id, label, maxRows = 3, placeholder) => {
  const [value, setValue] = useState(formData[id] || "");

  const handleChange = (e) => {
    const val = e.target.value;
    setValue(val);
    setFormData(prev => ({ ...prev, [id]: val }));
  };

  // Tính số dòng
  const rows = value ? Math.min(value.split("\n").length + 1, maxRows) : 1;

  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className={errors[id] ? "input-error" : ""}
        style={{ resize: "none" }}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );
};

  const renderTextarea = (id, label, rows = 3, placeholder) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={formData[id]}
        onChange={handleChange}
        placeholder={placeholder}
        rows={rows}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );
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
    setStep(tab === "instant" ? 1 : 0); // schedule bắt đầu từ step 1,  instant từ step 0
  }, [tab]);



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

      <p className="agent_name">AI Dialogue Architect Agent</p>
      <div
        className={`session-remain ${remainSessions === "0 sessions" ? "danger" : "normal"
          }`}
      >
        Remaining Sessions: {remainSessions || "Loading..."}
      </div>


      <div className="blue-glow"></div>
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

          {/* SECTION */}
          <div className="section-card">
            {step === 3 && (
              <>

                <div className="section-title">User A – Your Info</div>
                {renderInput("userName", "Your Name - Role", "text", "Your name - Role")}
                {renderInput("userCompanyName", "Company Name", "text", " Your Company Name")}
                {renderTextarea("userCompanyServices", "Services", 3, "Please provide clear information about your company, including Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc.")}

              </>
            )}
            {step === 2 && (
              <>
                <div className="section-title">User B – Prospect Info</div>
                {renderInput("prospectName", "Prospect Name - Role", "text", "Prospect Name - Role")}
                {renderInput("customerCompanyName", "Customer Company Name", "text", "Customer Company Name")}
                {renderTextarea("customerCompanyServices", "Customer Services", 3, "Please provide clear information about your prospect company, including its Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc.")}
              </>
            )}
            {step === 1 && (
              <div className="scrollable-step">
                <div className="section-title">Contextual Information</div>
                {renderTextarea("meetingGoal", "Meeting Goal",3,"Please be as specific as possible. Examples: Secure a partnership, schedule a demo, explore collaboration opportunities, close a sale, gather market research.")}
                {renderTextarea("meetingEmail", "Email (Optional)", "email")}
                {renderTextarea("meetingMessage", "Message (Optional)")}
                {renderTextarea("meetingNote", "Note (Optional)")}
              </div>
            )}

          </div>

          {/* Buttons */}
          <div className="btn-container">
            {step > 1 && <button className="btn back" onClick={handleBack}>Back</button>}
            {step < 3 && <button className="btn next" onClick={handleNext}>Next →</button>}
            {step === 3 && <button className="btn start" onClick={handleStart}>Start</button>}
          </div>
          {/* render các step 1 → 3 như cũ */}
        </>
      )}
      {/* Step Indicator */}
      {tab === "schedule" && (
        <div className="schedule-container">

          <PopupWithSidebar
            blocks={sampleBlocks}
            onSelectBlock={(block) => console.log("Selected:", block)}
          />  </div>
      )}

    </div>
  );
}
