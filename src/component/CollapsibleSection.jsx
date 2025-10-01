import React, { useState } from "react";
import ExpandDownIcon from "../assets/Expand_down.svg";
import "../styles/collapsibleSection.css";

export default function CollapsibleSection({
  step,
  title,
  currentStep,
  setCurrentStep,
  openSections,
  setOpenSections,
  children
}) {
  const isActiveStep = currentStep === step;
  const isOpen = openSections.includes(step);
  const finalStep = 5;
  const firstStep = 1;

  const toggleSection = () => {
    if (isOpen) {
      setOpenSections(openSections.filter((s) => s !== step));
    } else {
      setOpenSections([step]);
      setCurrentStep(step);
    }
  };

  return (
    <div className="collapsible-section">
      <div
        className={`collapsible-header ${currentStep === step ? "active-step" : "inactive-step"
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

      <div className={`collapsible-body ${isOpen ? "active" : ""}`}>
        {/* giữ children luôn trong DOM */}
        <div className="collapsible-content">{children}</div>

        {isActiveStep && step !== finalStep && step !==firstStep && (
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
        )}

      <div className="section-divider" />
      </div>

    </div>
  );
}
