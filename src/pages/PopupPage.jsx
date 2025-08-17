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

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleStart = () => {
    onStartMeeting(formData);
  };


  const sampleMeetingData = {
  userCompanyName: "GYMZ Việt Nam",
  userCompanyServices: "Cung cấp gói tập gym, thực phẩm bổ sung, và thiết bị thể hình",
  
  customerCompanyName: "Công ty ABC Tech",
  customerCompanyServices: "Giải pháp phần mềm cho doanh nghiệp",

  meetingGoal: "Giới thiệu gói tập doanh nghiệp & chương trình ưu đãi hợp tác",
  
  meetingEmail: `
Kính gửi anh/chị,

Em là Khánh từ GYMZ Việt Nam. Bên em hiện đang triển khai gói tập gym dành riêng cho nhân viên doanh nghiệp, 
giúp tăng cường sức khỏe và tinh thần làm việc. Khi đăng ký cho đội ngũ từ 10 người trở lên, anh/chị sẽ nhận được 
ưu đãi giảm 20% phí thành viên, kèm theo gói tập thử miễn phí trong 7 ngày. 

Rất mong được hẹn lịch để chia sẻ chi tiết hơn và lắng nghe nhu cầu của công ty mình.

Trân trọng,  
Khánh - GYMZ Việt Nam
  `,

  meetingMessage: "Xin chào anh/chị, hôm nay em muốn chia sẻ về chương trình hợp tác doanh nghiệp của GYMZ.",
  meetingNote: "Khách hàng quan tâm đến phúc lợi cho nhân viên, cần nhấn mạnh lợi ích về sức khỏe & tinh thần."
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
                <input
                  type="text"
                  id="userName"
                  placeholder="Enter your name"
                  value={formData.userName}
                  onChange={handleChange}
                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="prospectName">Prospect’s Name (User B)</label>
                <input
                  type="text"
                  id="prospectName"
                  placeholder="Enter prospect's name"
                  value={formData.prospectName}
                  onChange={handleChange}
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
                <input
                  type="text"
                  id="userCompanyName"
                  placeholder="Your company name"
                  value={formData.userCompanyName}
                  onChange={handleChange}
                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="userCompanyServices">Services</label>
                <input
                  type="text"
                  id="userCompanyServices"
                  placeholder="Services"
                  value={formData.userCompanyServices}
                  onChange={handleChange}
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
                <input
                  type="text"
                  id="customerCompanyName"
                  placeholder="Customer company name"
                  value={formData.customerCompanyName}
                  onChange={handleChange}
                />
              </div>
              <div className="meeting-form__company">
                <label htmlFor="customerCompanyServices">Services</label>
                <input
                  type="text"
                  id="customerCompanyServices"
                  placeholder="Services"
                  value={formData.customerCompanyServices}
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>

          {/* Meeting Goal */}
          <section className="form-section">
            <h2 className="section-title">Meeting Goal</h2>
            <input
              type="text"
              id="meetingGoal"
              placeholder="What's the goal of this meeting?"
              value={formData.meetingGoal}
              onChange={handleChange}
              className="input-full"
            />
          </section>

          {/* Next Button */}
          <div className="btn-next-container">
            <button id="btnNext" onClick={() => setStep(2)}>
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
