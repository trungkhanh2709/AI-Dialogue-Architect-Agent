import React, { useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // mặc định ở popup
  const [meetingData, setMeetingData] = useState(null); // lưu dữ liệu từ popup
const testMeetingData = {
  userName: "Trung Khánh",
  userCompanyName: "GYMZ Corp",
  userCompanyServices: "Gym management software",
  prospectName: "Nguyễn Văn A",
  customerCompanyName: "Fitness VN",
  customerCompanyServices: "Gym & fitness services",
  meetingGoal: "Demo AI sales agent",
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

       {/* {page === "meeting" && testMeetingData && (
        <MeetingPage
          meetingData={testMeetingData} // dùng dữ liệu từ popup
          onBack={() => setPage("popup")}
        />
      )} */}
    </>
  );
}
