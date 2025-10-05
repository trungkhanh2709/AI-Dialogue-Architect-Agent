import React, { useEffect, useState } from "react";
// import "../styles/popup.css";
import axios from "axios";
import PopupWithSidebar from "../component/PopupWithSidebar.jsx";
import ExpandableTextarea from "../component/ExpandableTextarea.jsx";

export default function PopupPage({ onStartMeeting, cookieUserName }) {
const VITE_URL_BACKEND = 'http://localhost:4000';
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



  console.log("decodedCookieEmail",decodedCookieEmail);
useEffect(() => {
  const fetchRemainSessions = () => {
   chrome.runtime.sendMessage(
  {
    type: "GET_REMAIN_SESSIONS",
    payload: {
      email: decodedCookieEmail,
      add_on_type: "ai_dialogue_architect_agent",
    },
  },
  (res) => {
    if (res.error || !res.data) {
      setRemainSessions("0 sessions");
      return;
    }
    const { value, trial } = res.data.content;
    setRemainSessions(trial ? `${value} sessions + Trial` : `${value} sessions`);
  }
);

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

 const handleStart = () => {
  if (!validateStep()) return;

  chrome.runtime.sendMessage(
    {
      type: "USE_ADDON_SESSION",
      payload: {
        email: decodedCookieEmail,
        add_on_type: "ai_dialogue_architect_agent"
      }
    },
    (res) => {
      if (!res || res.error || !res.data) {
        alert("An error occurred while calling the API");
        return;
      }

      // Reset & start timer
      chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
        chrome.runtime.sendMessage({ type: "START_TIMER" });
      });

      const data = res.data;
      if (data.trial_used === true || data.status === "200") {
        onStartMeeting(formData);
      } else {
        alert("You have run out of sessions. Please purchase an add-on to continue.");
      }
    }
  );
};



const renderTextarea = (id, label, rows = 3, placeholder) => {
  const words = formData[id].trim() === "" ? [] : formData[id].trim().split(/\s+/);
  const wordCount = words.length;

  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={formData[id]}
        onChange={(e) => {
          const newWords = e.target.value.trim() === "" ? [] : e.target.value.trim().split(/\s+/);
          if (newWords.length <= 1000) {
            handleChange(e);
          } else {
            e.target.value = formData[id]; // giữ giá trị cũ
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


      {/* <div className="blue-glow"></div> */}
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
            {step === 1 && (
              <>

                <div className="section-title">User A – Your Info</div>
                {renderInput("userName", "Your Name - Role/Title", "text", "Your name - Role/Title")}
                {renderInput("userCompanyName", "Company Name", "text", " Your Company Name")}
                {renderTextarea("userCompanyServices", "Your Company: Business, Products, and Services", 3, "Please provide clear information about your company, including Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc.")}

              </>
            )}
            {step === 2 && (
              <>
                <div className="section-title">User B – Prospect Info</div>
                {renderInput("prospectName", "Prospect's Name - Role/Title", "text", "Prospect's Name - Role/Title")}
                {renderInput("customerCompanyName", "Prospect Company Name", "text", "Prospect Company Name")}
                {renderTextarea("customerCompanyServices", "Prospect Company: Business, Products, and Services", 3, "Please provide clear information about your prospect company, including its Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc.")}
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
          onStartMeeting ={onStartMeeting}
            decodedCookieEmail={decodedCookieEmail}

            onSelectBlock={(block) => console.log("Selected:", block)}
          />  </div>
      )}

    </div>
  );
}
