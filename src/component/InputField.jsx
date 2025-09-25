import React from "react";

export default function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  error
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
      />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
}
