import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

function initToolbar() {
  let toolbar = document.getElementById("toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.id = "toolbar";
    Object.assign(toolbar.style, {
      position: "fixed",
      top: "10px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 999999,
      width: "35%",
      height: "50%",
      borderRadius: "16px",
      background: "transparent",
      boxShadow: "none",
      overflow: "hidden",
    });
    document.body.appendChild(toolbar);
  }

  ReactDOM.createRoot(toolbar).render(
    <React.StrictMode>
      <App defaultPage="meeting" />
    </React.StrictMode>
  );
}

initToolbar();
