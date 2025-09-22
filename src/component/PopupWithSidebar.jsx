import React, { useState, useEffect } from "react";
import "../styles/popupSidebar.css";
import SideBar from "./Sidebar";

export default function PopupWithSidebar({ blocks, onSelectBlock }) {
  const [selectedBlock, setSelectedBlock] = useState(null);
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
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => {
    if (selectedBlock) setFormData(selectedBlock);
  }, [selectedBlock]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const renderInput = (id, label, type = "text") => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );

  const renderTextarea = (id, label, rows = 3) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );

  return (
    <div className="popup-with-sidebar">
      <div className={`sidebar-wrapper ${sidebarVisible ? "" : "hidden"}`}>
        <SideBar
          blocks={blocks}
          onSelectBlock={(block) => {
            setSelectedBlock(block);
            onSelectBlock(block);
          }}
        />
      </div>

      {/* Nút toggle dính sát sidebar */}
      <button
        className={`sidebar-toggle ${sidebarVisible ? "expanded" : "collapsed"}`}
        onClick={() => setSidebarVisible((v) => !v)}
      >
        {sidebarVisible ? "<" : ">"}
      </button>

      <div className="form-wrapper">
        <div className="section-title">User A – Your Info</div>
        {renderInput("userName", "Your Name")}
        {renderInput("userCompanyName", "Company Name")}
        {renderTextarea("userCompanyServices", "Services")}

        <div className="section-title">User B – Prospect Info</div>
        {renderInput("prospectName", "Prospect Name")}
        {renderInput("customerCompanyName", "Customer Company Name")}
        {renderTextarea("customerCompanyServices", "Customer Services")}

        <div className="section-title">Contextual Information</div>
        {renderInput("meetingGoal", "Meeting Goal")}
        {renderInput("meetingEmail", "Email (Optional)", "email")}
        {renderInput("meetingMessage", "Message (Optional)")}
        {renderTextarea("meetingNote", "Note (Optional)")}
      </div>
    </div>
  );
}
