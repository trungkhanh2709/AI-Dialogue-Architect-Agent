import React, { useState } from "react";

export default function ExtensionLogin({ onLoginSuccess }) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { id, value } = event.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const username = String(formData.username || "").trim();
    const password = String(formData.password || "");

    if (!username || !password) {
      setError("Username and password are required.");
      return;
    }

    setIsSubmitting(true);
    chrome.runtime.sendMessage(
      {
        type: "LOGIN_ACCOUNT",
        payload: { username, password },
      },
      (response) => {
        setIsSubmitting(false);

        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || "Login failed.");
          return;
        }

        if (!response) {
          setError("Login service is unavailable. Please reload the extension and try again.");
          return;
        }

        if (!response?.ok) {
          setError(response?.error || "Login failed.");
          return;
        }

        onLoginSuccess?.(response?.data || null);
      }
    );
  };

  return (
    <div className="extension-container extension-login-shell">
      <div className="agent-header">
        <p className="agent_name">AI Dialogue Strategist Agent</p>
      </div>

      <div className="section-card extension-login-card">
        <div className="section-title">Sign In</div>
        <p className="extension-login-copy">
          Sign in with your ReelSights AI account to load profiles, Conversion
          Architect files, and live meeting context.
        </p>

        <form className="extension-login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your ReelSights username"
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error ? <div className="error-text">{error}</div> : null}

          <div className="btn-container">
            <button className="btn start" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
