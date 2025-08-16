import React from "react";
import "./popup.css";

export default function Popup({ onNavigate }) {
  const handleStartMeeting = () => {
    // Chuyển sang trang khác (meeting.html) trong extension
    window.location.href = "meeting.html";
  };

  return (
    <div className="extension-container">
      <p className="agent_name">Sale Agent</p>

      <p className="label_text">Your Company</p>
      <div className="meeting-form">
        <div className="meeting-form__company">
          <label htmlFor="user-company-name" className="meeting-form__label">
            Company Name
          </label>
          <input
            type="text"
            id="user-company-name"
            placeholder="Your company name"
            className="meeting-form__input"
          />
        </div>
        <div className="meeting-form__company">
          <label htmlFor="user-company-services" className="meeting-form__label">
            Services
          </label>
          <input
            type="text"
            id="user-company-services"
            className="meeting-form__input"
          />
        </div>
      </div>

      <p className="label_text">Customer's Company</p>
      <div className="meeting-form">
        <div className="meeting-form__company">
          <label htmlFor="customer-company-name" className="meeting-form__label">
            Company Name
          </label>
          <input
            type="text"
            id="customer-company-name"
            placeholder="Your customer's company name"
            className="meeting-form__input"
          />
        </div>
        <div className="meeting-form__company">
          <label htmlFor="customer-company-services" className="meeting-form__label">
            Services
          </label>
          <input
            type="text"
            id="customer-company-services"
            className="meeting-form__input"
          />
        </div>
      </div>

      <h3>Meeting Goal</h3>
      <div className="meeting-goal-container">
        <input type="text" id="meeting-goal" className="meeting-form__input" />
      </div>

      <h3>Email</h3>
      <div className="meeting-goal-container">
        <input type="text" id="meeting-email" className="meeting-form__input" />
      </div>

      <h3>Message</h3>
      <div className="meeting-goal-container">
        <input type="text" id="meeting-message" className="meeting-form__input" />
      </div>

      <h3>Note</h3>
      <div className="meeting-goal-container">
        <input type="text" id="meeting-note" className="meeting-form__input" />
      </div>

      <button id="btnStartMeeting" onClick={handleStartMeeting}>
        Start Meeting
      </button>
    </div>
  );
}

