import React, { useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // mặc định ở popup
  const [meetingData, setMeetingData] = useState(null); // lưu dữ liệu từ popup

  return (
    <>
      {page === "popup" && (
        <PopupPage
          onStartMeeting={(data) => {
            setMeetingData(data); // lưu dữ liệu từ popup
            setPage("meeting"); // chuyển sang MeetingPage
          }}
        />
      )}

      {page === "meeting" && meetingData && (
        <MeetingPage
          meetingData={meetingData} // dùng dữ liệu từ popup
          onBack={() => setPage("popup")}
        />
      )}
    </>
  );
}
