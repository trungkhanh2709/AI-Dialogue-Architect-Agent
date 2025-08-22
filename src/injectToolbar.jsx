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
      top: "0",
      left: "0",
      width: "100%",
      height: "300px",
      backgroundColor: "rgba(255,255,255,0.95)",
      zIndex: "9999",
      boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
      padding: "5px"
    });
    document.body.appendChild(toolbar);
  }

  // render React app
  const root = ReactDOM.createRoot(toolbar);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initToolbar();
