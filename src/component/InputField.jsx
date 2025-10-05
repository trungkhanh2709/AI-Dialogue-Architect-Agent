import React from "react";
// import "../styles/InputField.css";
export default function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  error,
  readOnly,
}) {
  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={error ? "input-error" : ""}
              readOnly={readOnly}

      />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
