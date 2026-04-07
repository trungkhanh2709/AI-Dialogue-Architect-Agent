import React, { useEffect, useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import UpgradePopup from "./pages/UpgradePopup.jsx";

export default function App() {
  const [page, setPage] = useState("popup");
  const [meetingData, setMeetingData] = useState(null);
  const [cookieUserName, setCookieUserName] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "CHECK_COOKIE" }, (response) => {
      if (response?.loggedIn) {
        setCookieUserName(response.username);
      }
    });
  }, []);

  useEffect(() => {
    if (showUpgrade) setPage("upgrade");
  }, [showUpgrade]);

  const stopKey = (e) => e.stopPropagation();

  return (
    <div
      className="ada-root"
      onKeyDownCapture={stopKey}
      onKeyUpCapture={stopKey}
      onKeyPressCapture={stopKey}
    >
      {page === "popup" && (
        <PopupPage
          cookieUserName={cookieUserName}
          onStartMeeting={(data) => {
            setMeetingData(data);
            setPage("meeting");
          }}
        />
      )}
      {page === "meeting" && meetingData && (
        <MeetingPage
          cookieUserName={cookieUserName}
          meetingData={meetingData}
          onBack={() => setPage("popup")}
          onExpire={() => setShowUpgrade(true)}
        />
      )}
      {page === "upgrade" && (
        <UpgradePopup
          onClose={() => {
            setShowUpgrade(false);
            setPage("popup");
          }}
          onContinue={() => {
            setShowUpgrade(false);
            setPage("meeting");
          }}
          userEmail={cookieUserName}
        />
      )}
    </div>
  );
}
