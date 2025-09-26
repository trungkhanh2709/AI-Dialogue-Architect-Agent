import { useRef, useEffect } from "react";
import  "../styles/ExpandTextarea.css";

const ExpandableTextarea = ({ id, label, placeholder, maxRows = 5, formData, setFormData, errors,readOnly = false }) => {
  const textareaRef = useRef(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const lineHeight = 24; // 1 dòng ~ 24px
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = Math.min(scrollHeight, lineHeight * maxRows) + "px";
    }6
  };

  useEffect(() => {
    resizeTextarea(); // chạy khi mount
  }, []);

  useEffect(() => {
    resizeTextarea(); // chạy khi value thay đổi
  }, [formData[id]]);

  return (
    <div className="input-area-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        ref={textareaRef}
        id={id}
        placeholder={placeholder}
        value={formData[id] || ""}
        onChange={(e) => setFormData(prev => ({ ...prev, [id]: e.target.value }))}
        style={{ resize: "vertical", overflow: "auto" }}
        className={errors[id] ? "input-error" : ""}
         readOnly={readOnly} 
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );
};

export default ExpandableTextarea;
