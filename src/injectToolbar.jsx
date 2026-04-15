import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import blockListCss from "../src/styles/BlocksList.css?raw";
import chatCss from "../src/styles/chat.css?raw";
import collapsibleSectionCss from "../src/styles/CollapsibleSection.css?raw";
import emailInputCss from "../src/styles/EmailInput.css?raw";
import expandTextareaCss from "../src/styles/ExpandTextarea.css?raw";
import GoogleCalendarCss from "../src/styles/GoogleCalendar.css?raw";
import InputFieldCss from "../src/styles/InputField.css?raw";
import meetingCss from "../src/styles/meeting.css?raw";
import popupCss from "../src/styles/popup.css?raw";
import SaveConfirmPopupCss from "../src/styles/SaveConfirmPopup.css?raw";
import sidebarCss from "../src/styles/sidebar.css?raw";
import popupSidebarCss from "../src/styles/popupSidebar.css?raw";
import upgradePopupCss from "../src/styles/upgradePopup.css?raw";
import settingPageCss from "../src/styles/settingPage.css?raw";
import AIPsychAnalyzerStep from "../src/styles/AIPsychAnalyzerStep.css?raw";
import ResponseModal from "../src/styles/modal.css?raw";
import ResultBlock from "../src/styles/ResultBlock.css?raw";
import GoogleLoginButton from "../src/styles/GoogleLoginButton.css?raw";
import v15Css from "../src/styles/v15.css?raw";

export function initToolbar() {
  let toolbarHost = document.getElementById("__ai_dialogue_toolbar__");

  if (!toolbarHost) {
    toolbarHost = document.createElement("div");
    toolbarHost.id = "__ai_dialogue_toolbar__";
    Object.assign(toolbarHost.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "0",
      height: "0",
      overflow: "visible",
      zIndex: "999999",
      pointerEvents: "auto",
    });

    document.body.appendChild(toolbarHost);

    const shadow = toolbarHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      popupCss +
      "\n" +
      meetingCss +
      "\n" +
      upgradePopupCss +
      popupSidebarCss +
      sidebarCss +
      collapsibleSectionCss +
      blockListCss +
      chatCss +
      "\n" +
      emailInputCss +
      expandTextareaCss +
      "\n" +
      GoogleCalendarCss +
      "\n" +
      InputFieldCss +
      SaveConfirmPopupCss +
      settingPageCss +
      AIPsychAnalyzerStep +
      ResponseModal +
      ResultBlock +
      GoogleLoginButton +
      "\n" +
      v15Css;

    shadow.appendChild(style);

    const inner = document.createElement("div");
    ["keydown", "keyup", "keypress"].forEach((type) => {
      inner.addEventListener(
        type,
        (e) => {
          if (inner.contains(e.target)) {
            e.stopPropagation();
          }
        },
        true
      );
    });

    Object.assign(inner.style, {
      position: "relative",
      width: "0",
      height: "0",
      backgroundColor: "transparent",
      boxShadow: "none",
      pointerEvents: "auto",
    });

    shadow.appendChild(inner);

    window.toolbarRoot = ReactDOM.createRoot(inner);
    window.toolbarRoot.render(<App />);
  } else {
    toolbarHost.style.display =
      toolbarHost.style.display === "none" ? "block" : "none";
  }
}

initToolbar();
