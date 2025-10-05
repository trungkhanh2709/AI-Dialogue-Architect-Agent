import React, { useState } from "react";

export default function SettingsPage({ onBack }) {
  const [autoSave, setAutoSave] = useState(
    localStorage.getItem("autoSaveEnabled") === "true"
  );

  const handleToggle = () => {
  const newValue = !autoSave;
  setAutoSave(newValue);
  localStorage.setItem("autoSaveEnabled", newValue);
};


  return (
    <div className="settings-page">
      <h2 className="setting_text">Settings</h2>
      <div className="setting-item">
        <span className="setting-description">Automatically save your call data to our server</span>

        <label className="switch">
          <input
            type="checkbox"
            checked={autoSave}
            onChange={handleToggle}
          />
          <span className="slider"></span>
        </label>
      </div>
      <div className="btn-container">
        <button className="btn back" onClick={onBack}>Back</button>
      </div>    
      </div>
  );
}
