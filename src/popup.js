// popup.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/popup.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App defaultPage="popup" />
  </React.StrictMode>
);
