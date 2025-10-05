import React from "react";
// import "../styles/saveConfirmPopup.css";

export default function SaveConfirmPopup({ onConfirm, onCancel }) {
  return (
    <div className="popup-overlay">
      <div className="popup-box">
        <h3>Do you want to save this meeting's data?</h3>
        <p>
          The meeting data, including the call content, will be saved to our database.
          If you change your mind later and want to enable/disable saving, you can adjust it in the settings.
        </p>
        <div className="popup-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-save" onClick={onConfirm}>Save</button>
        </div>
      </div>
    </div>
  );
}
