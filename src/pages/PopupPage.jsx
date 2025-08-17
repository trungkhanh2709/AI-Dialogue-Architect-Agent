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


  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.userName.trim()) newErrors.userName = "Required field";
    if (!formData.prospectName.trim()) newErrors.prospectName = "Required field";
    if (!formData.userCompanyName.trim()) newErrors.userCompanyName = "Required field";
    if (!formData.userCompanyServices.trim()) newErrors.userCompanyServices = "Required field";
    if (!formData.customerCompanyName.trim()) newErrors.customerCompanyName = "Required field";
    if (!formData.customerCompanyServices.trim()) newErrors.customerCompanyServices = "Required field";
    if (!formData.meetingGoal.trim()) newErrors.meetingGoal = "Required field";

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0; // true nếu valid
  };


  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleStart = () => {
    onStartMeeting(formData);
  };




  return (
    <div className="extension-container">
      <h1 className="agent_name">Sale Agent</h1>

      {/* Step Indicator */}
      <div className="step-indicator">
        <div className={`step-circle ${step >= 1 ? "active" : ""}`}>
          1
        </div>
        <div className="step-line"></div>
        <div className={`step-circle ${step === 2 ? "active" : ""}`}>
          2
        </div>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <>
          {/* Personal Info */}
          <section className="form-section">
            <h2 className="section-title">Personal Info</h2>
            <div className="meeting-form">
              <div className="meeting-form__company">
                <label htmlFor="userName">Your Name (User A)</label>
                {errors.userName && <div className="error-text">{errors.userName}</div>}
                <input
                  type="text"
                  id="userName"
                  placeholder="Enter your name"
                  value={formData.userName}
                  onChange={handleChange}
                  className={errors.userName ? "input-error" : ""}
                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="prospectName">Prospect’s Name (User B)</label>
                {errors.userName && <div className="error-text">{errors.prospectName}</div>}
                <input
                  type="text"
                  id="prospectName"
                  placeholder="Enter prospect's name"
                  value={formData.prospectName}
                  onChange={handleChange} className={errors.prospectName ? "input-error" : ""}
                />
              </div>
            </div>
          </section>

          {/* Your Company */}
          <section className="form-section">
            <h2 className="section-title">Your Company</h2>
            <div className="meeting-form">
              <div className="meeting-form__company">
                <label htmlFor="userCompanyName">Company Name</label>
                {errors.userName && <div className="error-text">{errors.userCompanyName}</div>}
                <input
                  type="text"
                  id="userCompanyName"
                  placeholder="Your company name"
                  value={formData.userCompanyName}
                  onChange={handleChange}
                  className={errors.userCompanyName ? "input-error" : ""}
                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="userCompanyServices">Services</label>
                {errors.userCompanyServices && <div className="error-text">{errors.userCompanyServices}</div>}

                <input
                  type="text"
                  id="userCompanyServices"
                  placeholder="Services"
                  value={formData.userCompanyServices}
                  onChange={handleChange}
                  className={errors.userCompanyServices ? "input-error" : ""}
                />
              </div>
            </div>
          </section>

          {/* Customer Company */}
          <section className="form-section">
            <h2 className="section-title">Customer's Company</h2>
            <div className="meeting-form">
              <div className="meeting-form__company">
                <label htmlFor="customerCompanyName">Company Name</label>
                {errors.customerCompanyName && <div className="error-text">{errors.customerCompanyName}</div>}

                <input
                  type="text"
                  id="customerCompanyName"
                  placeholder="Customer company name"
                  value={formData.customerCompanyName}
                  onChange={handleChange}
                  className={errors.customerCompanyName ? "input-error" : ""}

                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="customerCompanyServices">Services</label>
                {errors.customerCompanyServices && <div className="error-text">{errors.customerCompanyServices}</div>}

                <input
                  type="text"
                  id="customerCompanyServices"
                  placeholder="Services"
                  value={formData.customerCompanyServices}
                  onChange={handleChange}
                  className={errors.customerCompanyServices ? "input-error" : ""}

                />
              </div>
            </div>
          </section>

          {/* Meeting Goal */}
          <section className="form-section">
            <h2 className="section-title">Meeting Goal</h2>          
                  {errors.meetingGoal && <div className="error-text">{errors.meetingGoal}</div>}

            <input
              type="text"
              id="meetingGoal"
              placeholder="What's the goal of this meeting?"
              value={formData.meetingGoal}
              onChange={handleChange}
className={`input-full ${errors.meetingGoal ? "input-error" : ""}`}
              
            />
          </section>

          {/* Next Button */}
          <div className="btn-next-container">
            <button
              id="btnNext"
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              Next →
            </button>

          </div>
        </>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <>
          {/* Optional Info */}
          <section className="form-section optional-section">
            <h2 className="section-title">Optional Info</h2>
            <div className="optional-box">
              <input
                type="email"
                id="meetingEmail"
                placeholder="Email (optional)"
                value={formData.meetingEmail}
                onChange={handleChange}
              />
              <input
                type="text"
                id="meetingMessage"
                placeholder="Message (optional)"
                value={formData.meetingMessage}
                onChange={handleChange}
              />
              <input
                type="text"
                id="meetingNote"
                placeholder="Note (optional)"
                value={formData.meetingNote}
                onChange={handleChange}
              />
            </div>
          </section>

          <div className="step-buttons">
            <button id="btnBack" onClick={() => setStep(1)}>Back</button>
            <button id="btnStartMeeting" onClick={handleStart}>
              Start Meeting
            </button>
          </div>
        </>
      )}
    </div>
  );
}
