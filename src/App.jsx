//app.jsx

import React, { useState, useEffect } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";
import UpgradePopup from "./pages/UpgradePopup.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // "popup" | "meeting"
  const [meetingData, setMeetingData] = useState(null);
  const [user, setUser] = useState(null);
  const [cookieUserName, setCookieUserName] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false); // quản lý popup global
  const stopKey = (e) => e.stopPropagation();


  useEffect(() => {
    const toolbar = document.getElementById("__ai_dialogue_toolbar__");
    if (!toolbar) return;

    if (page === "popup") {
      // Display full height right side
      Object.assign(toolbar.style, {
        top: "1vh",
        right: "1vh",
        left: "auto",
        transform: "none",
        height: "100vh",

        borderRadius: "24px",
        boxShadow: "0 0 10px rgba(0,0,0,0.3)",
      });
    } else if (page === "meeting") {
      // top-center auto height
      Object.assign(toolbar.style, {
        top: "0",
        left: "50%",
        right: "auto",
        transform: "translateX(-50%)",
        width: "35%",
        height: "50vh",
        borderRadius: "24px",
        backgroundColor: "transparent",
        boxShadow: "none",
      });
    } else if (page === "upgrade") {
      Object.assign(toolbar.style, {
        top: "40%",
        left: "55%",
        right: "auto",
        transform: "translate(-50%, -50%)", // căn giữa cả ngang + dọc
        width: "80%",
        height: "fit-content",
        borderRadius: "16px",

        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      });
    }
  }, [page]);

  const testMeetingData = {
    userName: "Trung Khánh",
    userCompanyName: "GYMZ Corp",
    userCompanyServices: "Gym management software",
    prospectName: "Thảo Vân",
    customerCompanyName: "Beauty Spa",
    customerCompanyServices: "cung cấp dịch vụ làm đẹp",
    meetingGoal: "chốt gói dịch vụ gym cho khách hàng",
    meetingEmail: "khankhanh@example.com",
    meetingMessage: "Xin chào, mình muốn demo hệ thống AI bán hàng.",
    meetingNote: "Cuộc họp test nội bộ",
    meetingLog: [
      "Khánh Trung: \"Xin chào!\"",
      "Nguyễn Văn A: \"Chào bạn, rất vui được gặp.\"",
    ].join("\n"),
  };

  useEffect(() => {
    if (showUpgrade) {
      setPage("upgrade");
    }
  }, [showUpgrade]);
  useEffect(() => {
    // check cookie khi app load
    chrome.runtime.sendMessage({ action: "CHECK_COOKIE" }, (response) => {
      if (response?.loggedIn) {
        setCookieUserName(response.username);
        setPage("popup");
      }
    });
  }, []);
  return (
    <>
 <div
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
      {/* {page === "meeting" && meetingData && (
        <MeetingPage
          cookieUserName={cookieUserName}

          meetingData={meetingData}
          onBack={() => setPage("popup")}
        />
      )} */}
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
          onClose={() => setPage("popup")}
          userEmail={cookieUserName}
        />
      )}
    </div>

    </>
  );
}
