import React, { useState, useRef, useEffect } from "react";
import ExpandDownIcon from "../assets/Expand_down.svg";

export default function CollapsibleSection({
  step,
  title,
  currentStep,
  setCurrentStep,
  openSections,
  setOpenSections,
  children,
}) {
  const isActiveStep = currentStep === step;
  const isOpen = openSections.includes(step);
  const finalStep = 4;
  const firstStep = 1;

  const bodyRef = useRef(null);
  const [bodyHeight, setBodyHeight] = useState(0);

  const toggleSection = () => {
    if (isOpen) {
      setOpenSections(openSections.filter((s) => s !== step));
    } else {
      setOpenSections([step]);
      setCurrentStep(step);
    }
  };

  // Cập nhật height động mỗi khi mở hoặc content thay đổi
  useEffect(() => {
    if (isOpen && bodyRef.current) {
      const el = bodyRef.current;
      const scrollHeight = el.scrollHeight;
      setBodyHeight(scrollHeight);
    } else {
      setBodyHeight(0);
    }
  }, [isOpen, children]);

  return (
    <div className="collapsible-section">
      <div
        className={`collapsible-header ${
          isActiveStep ? "active-step" : "inactive-step"
        }`}
        onClick={toggleSection}
      >
        <span className="collapsible-title">{title}</span>
        <img
          src={ExpandDownIcon}
          alt="expand"
          className={`arrow ${isOpen ? "open" : ""}`}
        />
      </div>

      <div
        className={`collapsible-body ${isOpen ? "active" : ""}`}
        style={{
          maxHeight: isOpen ? `${bodyHeight}px` : "0px",
        }}
      >
        {/* luôn giữ children trong DOM */}
        <div ref={bodyRef} className="collapsible-content">
          {children}

          {/* {isActiveStep &&
            step !== finalStep &&
            step !== firstStep && (
              <div className="continue-container">
                <button
                  className="continue-button"
                  onClick={() => {
                    setCurrentStep(step + 1);
                    setOpenSections([step + 1]);
                  }}
                >
                  Continue →
                </button>
              </div>
            )} */}

          <div className="section-divider" />
        </div>
      </div>
    </div>
  );
}
