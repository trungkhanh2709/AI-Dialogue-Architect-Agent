import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

const toolbarDiv = document.getElementById("toolbar");
if (toolbarDiv) {
  console.log("Rendering React app in existing toolbar div");
  ReactDOM.createRoot(toolbarDiv).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
