import React, { useEffect, useState } from "react";
import "../styles/popup.css";
import axios from "axios";

export default function PopupPage({ onStartMeeting, cookieUserName }) {
  const VITE_URL_BACKEND = import.meta.env.VITE_URL_BACKEND;

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
          setRemainSessions(res.data.content.value);
        } else {
          setRemainSessions(0);
        }
      } catch (err) {
        console.error("Error fetching remain sessions:", err);
        setRemainSessions(0);
      }
    };
    fetchRemainSessions();
  }, [decodedCookieEmail]);

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


  const renderTextarea = (id, label, rows = 3) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={formData[id]}
        onChange={handleChange}
        rows={rows}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );
  const renderInput = (id, label, type = "text") => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <input
        type={type}
        id={id}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );



  return (
    <div className="extension-container">
      <p className="agent_name">AI Dialogue Architect Agent</p>
      <div className="blue-glow"></div>
      <div
        className={`session-remain ${remainSessions <= 1 ? "danger" : "normal"
          }`}
      >
        Remaining Sessions:{" "}
        {remainSessions !== null ? remainSessions : "Loading..."}
      </div>
      {/* Step Indicator */}
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
            {renderInput("userName", "Your Name")}
            {renderInput("userCompanyName", "Company Name")}
            {renderTextarea("userCompanyServices", "Services")}

          </>
        )}
        {step === 2 && (
          <>
            <div className="section-title">User B – Prospect Info</div>
            {renderInput("prospectName", "Prospect Name")}
            {renderInput("customerCompanyName", "Customer Company Name")}
            {renderTextarea("customerCompanyServices", "Customer Services")}
          </>
        )}
        {step === 3 && (
          <div className="scrollable-step">
            <div className="section-title">Contextual Information</div>
            {renderInput("meetingGoal", "Meeting Goal")}
            {renderInput("meetingEmail", "Email (Optional)", "email")}
            {renderInput("meetingMessage", "Message (Optional)")}
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
    </div>
  );
}
