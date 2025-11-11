// src/component/CalendarAuthButton.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  isCalendarSignedIn,
  signInCalendarAndGetAppToken,
  signOutCalendar,
  getCalendarUser,
} from "../api/aiDialogueCalendarAuth";

export default function CalendarAuthButton({ label, onAuthChanged }) {
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const refreshingRef = useRef(false);

  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setLoading(true);

    try {
      const ok = await isCalendarSignedIn();
      setSignedIn(ok);

      if (ok) {
        const u = await getCalendarUser();
        setUser(u);
        onAuthChanged && onAuthChanged(true, u);
      } else {
        setUser(null);
        onAuthChanged && onAuthChanged(false, null);
      }
    } catch (e) {
      console.warn("[CalendarAuth] refresh error:", e);
      setSignedIn(false);
      setUser(null);
      onAuthChanged && onAuthChanged(false, null);
    } finally {
      setLoading(false);
      refreshingRef.current = false;
    }
  };

  useEffect(() => {
    const handler = (ev) => {
      if (
        ev.data &&
        (ev.data.type === "OAUTH_DONE" || ev.data.source === "rsai-oauth")
      ) {
        refresh();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    refresh();
  }, []);

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
      await signInCalendarAndGetAppToken();
      await refresh();
    } catch (e) {
      alert(
        "Sign-in failed: " + (e && e.message ? e.message : String(e || ""))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOutCalendar();
      await refresh();
    } finally {
      setLoading(false);
      setMenuOpen(false);
    }
  };

  // Chưa đăng nhập
  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="glb-outer glb-btn glb-btn--detail"
      >
        <img
          src="https://www.gstatic.com/images/branding/product/1x/calendar_512dp.png"
          alt="Google Calendar"
          className="glb-google-icon"
        />
        <div className="glb-text">
          <div className="glb-title">
            {loading
              ? "Connecting…"
              : label || "Connect Google Calendar"}
          </div>
        </div>
      </button>
    );
  }

  // Đã đăng nhập -> hiện tên + menu Sign out
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

        <div className="glb-info">
          <strong className="glb-name">
            {user && (user.name || user.email) || "Calendar Connected"}
          </strong>
          {user && user.email && (
            <small className="glb-email">{user.email}</small>
          )}
        </div>

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
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
