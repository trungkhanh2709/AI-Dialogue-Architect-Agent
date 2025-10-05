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



export function initToolbar() {
  let toolbarHost = document.getElementById("__ai_dialogue_toolbar__");

  if (!toolbarHost) {
    // tạo host container
    toolbarHost = document.createElement("div");
    toolbarHost.id = "__ai_dialogue_toolbar__";
    Object.assign(toolbarHost.style, {
      position: "fixed",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "999999",
      pointerEvents: "none", // không chặn click bên ngoài
    });

    document.body.appendChild(toolbarHost);

    // tạo Shadow DOM
    const shadow = toolbarHost.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = popupCss + "\n" + meetingCss + "\n" + upgradePopupCss + "\n" + popupSidebarCss
      + "\n" + sidebarCss + "\n"
      + collapsibleSectionCss
      + blockListCss + "\n" + chatCss + "\n" + emailInputCss + expandTextareaCss
      + "\n" + GoogleCalendarCss + "\n" + InputFieldCss + SaveConfirmPopupCss;

    shadow.appendChild(style);
    // wrapper nội dung React
    const inner = document.createElement("div");
    Object.assign(inner.style, {
      position: "absolute",
       top: "10px",
  right: "10px",      
      minWidth: "500px",
      width: "500px",
      maxHeight: "80vh",
      backgroundColor: "transparent",
      borderRadius: "24px",
      boxShadow: "none",
      overflowY: "auto",
      pointerEvents: "auto", // chỉ nội dung toolbar nhận sự kiện
    });

    shadow.appendChild(inner);

    // render React app vào Shadow DOM
    window.toolbarRoot = ReactDOM.createRoot(inner);
    window.toolbarRoot.render(<App />);
  } else {
    // toggle display
    toolbarHost.style.display = toolbarHost.style.display === "none" ? "block" : "none";
  }
}

initToolbar();
