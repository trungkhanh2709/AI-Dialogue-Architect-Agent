import { useState } from "react";
import "../styles/EmailInput.css";

export default function EmailInput({label, emails, setEmails, error }) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = inputValue.trim();
      if (value && validateEmail(value) && !emails.includes(value)) {
        setEmails([...emails, value]);
      }
      setInputValue("");
    }
  };

  const handleRemove = (email) => {
    setEmails(emails.filter((e) => e !== email));
  };

  return (
    <div className="email-input-wrapper">
           {label && <label className="email-input-label">{label}</label>}

      {emails.map((email) => (
        <div key={email} className="email-chip">
          {email}
          <button type="button" onClick={() => handleRemove(email)}>
            ×
          </button>
        </div>
      ))}

      <input
      className="email-input-field"
        type="text"
        value={inputValue}
        placeholder="Enter guest emails..."
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}

function validateEmail(email) {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
}
