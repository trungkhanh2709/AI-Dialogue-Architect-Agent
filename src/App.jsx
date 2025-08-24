import React, { useState, useEffect } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // popup hoặc meeting
  const [meetingData, setMeetingData] = useState(null);

  useEffect(() => {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;

    if (page === "popup") {
      // hiển thị bên phải full height
      Object.assign(toolbar.style, {
        top: "5vh",
        right: "5vh",
        left: "auto",
        transform: "none",
        width: "26%",
        height: "80vh",
        maxHeight: "100vh",
        borderRadius: "24px",
        backgroundColor: "white",
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
        height: "auto",
        maxHeight: "400px",
        borderRadius: "24px",
        backgroundColor: "transparent",
        boxShadow: "none",
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

  return (
    <>
      {page === "popup" && (
        <PopupPage
          onStartMeeting={(data) => {
            setMeetingData(data);
            setPage("meeting");
          }}
        />
      )}
      {page === "meeting" && meetingData && (
        <MeetingPage
          meetingData={meetingData}
          onBack={() => setPage("popup")}
        />
      )}
    </>
  );
}
