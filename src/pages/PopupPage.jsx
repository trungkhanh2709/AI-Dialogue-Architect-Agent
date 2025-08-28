import React, { useState } from "react";
import "../styles/popup.css";

export default function PopupPage({ onStartMeeting }) {
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
    if (validateStep()) onStartMeeting(formData);
  };

  const renderTextarea = (id, label, rows = 3) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      {errors[id] && <div className="error-text">{errors[id]}</div>}
      <textarea
        id={id}
        value={formData[id]}
        onChange={handleChange}
        rows={rows}
        className={errors[id] ? "input-error" : ""}
      />
    </div>
  );
  const renderInput = (id, label, type = "text") => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      {errors[id] && <div className="error-text">{errors[id]}</div>}
      <input
        type={type}
        id={id}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
    </div>
  );

  return (
    <div className="extension-container">
      <p className="agent_name">AI Dialogue Architect Agent</p>

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
        {step === 3 && <button className="btn start" onClick={handleStart}>Start Meeting</button>}
      </div>
    </div>
  );
}
