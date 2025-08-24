import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; // App chứa PopupPage và MeetingPage

export function initToolbar() {
  // Kiểm tra toolbar đã có chưa
  let toolbar = document.getElementById("toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "toolbar";
    Object.assign(toolbar.style, {
      position: "fixed",
      top: "0",
      left: "50%",
       transform: "translateX(-50%)",
      width: "35%",
      height: "auto",
      maxHeight: "400px",
      backgroundColor: "transparent",
      borderRadius: "24px",
  border: "1px solid rgba(255, 255, 255, 0.2)",

      zIndex: "9999",
      // boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
      boxShadow: "none",
      overflowY: "disable",
    });
    document.body.appendChild(toolbar);
  } else {
    // toggle hiển thị
    toolbar.style.display = toolbar.style.display === "none" ? "block" : "none";
    if (toolbar.style.display === "none") return;
  }

  // render React App vào toolbar
  if (!window.toolbarRoot) {
    window.toolbarRoot = ReactDOM.createRoot(toolbar);
    window.toolbarRoot.render(<App />);
  }
}

// tự động init khi inject
initToolbar();
