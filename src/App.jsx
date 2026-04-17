import React, { useEffect, useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import ExtensionLogin from "./component/ExtensionLogin.jsx";

export default function App() {
  const [page, setPage] = useState("popup");
  const [meetingData, setMeetingData] = useState(null);
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrappedFromWindow, setBootstrappedFromWindow] = useState(false);

  const loadDetachedMeetingData = async () => {
    try {
      const view = new URLSearchParams(window.location.search).get("view");
      if (view !== "meeting") return null;

      const key = "ada_detached_meeting_data";
      if (chrome.storage?.session) {
        const data = await chrome.storage.session.get(key);
        return data?.[key] || null;
      }
      if (chrome.storage?.local) {
        const data = await chrome.storage.local.get(key);
        return data?.[key] || null;
      }
    } catch {}
    return null;
  };

  useEffect(() => {
    (async () => {
      const detachedMeeting = await loadDetachedMeetingData();
      if (detachedMeeting) {
        setMeetingData(detachedMeeting);
        setPage("meeting");
      }
      setBootstrappedFromWindow(true);

      chrome.runtime.sendMessage({ type: "GET_ACCOUNT_AUTH" }, (response) => {
        if (response?.loggedIn) {
          setAuthSession(response);
        } else {
          setAuthSession(null);
        }
        setAuthReady(true);
      });
    })();
  }, []);

  const stopKey = (e) => e.stopPropagation();

  if (!bootstrappedFromWindow || !authReady) {
    return null;
  }

  return (
    <div
      className="ada-root"
      onKeyDownCapture={stopKey}
      onKeyUpCapture={stopKey}
      onKeyPressCapture={stopKey}
    >
      {!authSession?.loggedIn && (
        <ExtensionLogin
          onLoginSuccess={(session) => {
            setAuthSession({ ...session, loggedIn: true });
            setPage("popup");
          }}
        />
      )}
      {authSession?.loggedIn && page === "popup" && (
        <PopupPage
          cookieUserName={authSession?.username}
          onStartMeeting={(data) => {
            setMeetingData(data);
            setPage("meeting");
          }}
        />
      )}
      {authSession?.loggedIn && page === "meeting" && meetingData && (
        <MeetingPage
          cookieUserName={authSession?.username}
          meetingData={meetingData}
          onBack={() => setPage("popup")}
        />
      )}
    </div>
  );
}
