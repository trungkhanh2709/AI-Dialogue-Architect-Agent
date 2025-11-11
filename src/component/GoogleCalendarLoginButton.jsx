/// <reference types="chrome" />
import React, { useEffect, useState, useRef } from "react";
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

  const cardRef = useRef(null);

  const refresh = async () => {
    console.log("[ai-dialogue] refresh() called");
    setLoading(true);
    try {
      const ok = await isSignedInCalendar();
      console.log("[ai-dialogue] isSignedInCalendar =", ok);
      setSignedIn(ok);

      if (ok) {
        const u = await getAiDialogueGoogleUser();
        console.log("[ai-dialogue] getAiDialogueGoogleUser ->", u);
        setUser(u);
        onAuthChanged && onAuthChanged(true, u || null);
      } else {
        setUser(null);
        onAuthChanged && onAuthChanged(false, null);
      }
    } catch (e) {
      console.warn("[ai-dialogue] refresh error:", e);
      setUser(null);
      setSignedIn(false);
      onAuthChanged && onAuthChanged(false, null);
    } finally {
      setLoading(false);
    }
  };

  // Listen OAuth done
  useEffect(() => {
    const handler = (ev) => {
      const data = ev.data;
      if (!data) return;

      if (data.source === "rsai-oauth" && data.data?.app === "ai_dialogue_calendar") {
        console.log("[ai-dialogue] message from oauth popup (rsai-oauth)");
        refresh();
      }

      if (data.type === "OAUTH_DONE_AI_DIALOGUE") {
        console.log("[ai-dialogue] OAUTH_DONE_AI_DIALOGUE message");
        refresh();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // First load
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menu on click outside (kể cả đang ở shadow DOM)
  useEffect(() => {
    if (!menuOpen) return;

    const onClick = (e) => {
      const cardEl = cardRef.current;
      if (!cardEl) return;

      const path = e.composedPath ? e.composedPath() : [];
      if (!path.includes(cardEl)) {
        setMenuOpen(false);
      }
    };

    // capture = true để bắt cả sự kiện trong shadow DOM
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [menuOpen]);

  const handleLogin = async () => {
    console.log("[ai-dialogue] Login clicked");
    setLoading(true);
    try {
      await signInAndGetCalendarToken();
      await refresh();
    } catch (e) {
      console.warn("[ai-dialogue] Sign-in failed:", e);
      alert(`Sign-in failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log("[ai-dialogue] Logout clicked");
    setLoading(true);
    try {
      await signOutCalendarApp();
      console.log("[ai-dialogue] signOutCalendarApp done, calling refresh");
      await refresh();
    } catch (e) {
      console.warn("[ai-dialogue] Logout error:", e);
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  // ============ Signed out ============
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

  // ============ Signed in ============
  return (
    <div className="glb-outer glb-card" ref={cardRef}>
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

        <div className="glb-info">
          <strong className="glb-name">
            {(user && user.name) || "Connected to Google Calendar"}
          </strong>
          <small className="glb-email">{(user && user.email) || ""}</small>
        </div>

        <button
          type="button"
          className="glb-ellipsis-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          disabled={loading}
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="glb-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="glb-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            disabled={loading}
          >
            {loading ? "Disconnecting..." : "Logout"}
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendarLoginButton;
