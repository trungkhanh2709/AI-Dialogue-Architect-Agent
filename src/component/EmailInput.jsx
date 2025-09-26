import { useState, useRef, useEffect } from "react";
import "../styles/EmailInput.css";

export default function EmailInput({ label, emails, setEmails, error, inputRef,clearTrigger }) {
  const [inputValue, setInputValue] = useState("");
  const internalRef = useRef();
  const ref = inputRef || internalRef;

  useEffect(() => {
    if (clearTrigger) setInputValue("");  // khi GoogleCalendar muốn xoá input
  }, [clearTrigger]);


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
          <button type="button" onClick={() => setEmails(emails.filter((e) => e !== email))}>
            ×
          </button>
        </div>
      ))}

      <input
        ref={ref}
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
