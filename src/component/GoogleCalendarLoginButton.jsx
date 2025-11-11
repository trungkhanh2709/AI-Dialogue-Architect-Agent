// src/component/GoogleCalendarLoginButton.jsx

/// <reference types="chrome" />
import React, { useEffect, useRef, useState } from "react";
import {
  getAiDialogueGoogleUser,
  isSignedInCalendar,
  signInAndGetCalendarToken,
  signOutCalendarApp,
} from "../api/authGoogleCalendar.js";

const GoogleCalendarLoginButton = ({ onAuthChanged, label }) => {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [signedIn, setSignedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);
  const refreshingRef = useRef(false);

  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);

    try {
      const ok = await isSignedInCalendar();
      setSignedIn(ok);

      if (ok) {
        const u = await getAiDialogueGoogleUser();
        setUser(u);
        onAuthChanged && onAuthChanged(true, u || null);
      } else {
        setUser(null);
        onAuthChanged && onAuthChanged(false, null);
      }
    } catch (e) {
      console.warn("[ai-dialogue calendar] refresh error:", e);
      setUser(null);
      setSignedIn(false);
      onAuthChanged && onAuthChanged(false, null);
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  };

  // Lắng message từ popup
  useEffect(() => {
    const handler = (ev) => {
      const data = ev.data;
      if (!data) return;

      // Từ callback BE: { source: "rsai-oauth", data: { app, ... } }
      if (data.source === "rsai-oauth" && data.data?.app === "ai_dialogue_calendar") {
        refresh();
        return;
      }

      // Từ FE (nếu signInAndGetCalendarToken postMessage "OAUTH_DONE_AI_DIALOGUE")
      if (data.type === "OAUTH_DONE_AI_DIALOGUE") {
        refresh();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load state lần đầu
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click outside để đóng menu
  useEffect(() => {
    if (!menuOpen) return;

    const onDocClick = (e) => {
      const t = e.target;
      if (menuRef.current && !menuRef.current.contains(t)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await signInAndGetCalendarToken();
      await refresh();
    } catch (e) {
      alert(`Sign-in failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOutCalendarApp();
      await refresh();
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  // ================== Signed out ==================
  if (!signedIn) {
    return (
      <button
        onClick={handleLogin}
        disabled={loading}
        className="glb-outer glb-btn glb-btn--detail"
      >
        <img
          src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png"
          alt="Google Calendar"
          className="glb-google-icon"
        />
        <div className="glb-text">
          <div className="glb-title">
            {loading ? "Connecting…" : label || "Connect Google Calendar"}
          </div>
        </div>
      </button>
    );
  }

  // ================== Signed in ==================
  return (
    <div className="glb-outer glb-card" ref={menuRef}>
      <div className="glb-card-row">
        {user && user.picture ? (
          <img
            src={user.picture}
            alt={user.name || user.email || "Google user"}
            className="glb-avatar"
          />
        ) : (
          <div className="glb-avatar glb-avatar-fallback">G</div>
        )}

       <strong className="glb-name">
  {(user && user.name) || "Connected to Google Calendar"}
</strong>
<small className="glb-email">{(user && user.email) || ""}</small>


        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="More"
          className="glb-ellipsis-btn"
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div role="menu" className="glb-menu">
          <button
            type="button"
            onClick={handleLogout}
            role="menuitem"
            className="glb-menu-item"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendarLoginButton;
