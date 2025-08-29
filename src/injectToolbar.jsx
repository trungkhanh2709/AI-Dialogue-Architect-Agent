import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

export function initToolbar() {
  // Check if the toolbar is already there.
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
      backgroundColor: "transparent",
      borderRadius: "24px",
      // border: "1px solid rgba(255, 255, 255, 0.2)",
      border: "1px solid rgba(241, 12, 12, 1)",
      zIndex: "9999",
      boxShadow: "none",
      overflowY: "disable",
    });
    document.body.appendChild(toolbar);
  } else {
    // toggle display 
    toolbar.style.display = toolbar.style.display === "none" ? "block" : "none";
    if (toolbar.style.display === "none") return;
  }

  // render React App into toolbar
  if (!window.toolbarRoot) {
    window.toolbarRoot = ReactDOM.createRoot(toolbar);
    window.toolbarRoot.render(<App />);
  }
}

initToolbar();
