import React, { useEffect, useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup");
  const [meetingData, setMeetingData] = useState(null);
  const [cookieUserName, setCookieUserName] = useState(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ action: "CHECK_COOKIE" }, (response) => {
      if (response?.loggedIn) {
        setCookieUserName(response.username);
      }
    });
  }, []);

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
        />
      )}
    </div>
  );
}
