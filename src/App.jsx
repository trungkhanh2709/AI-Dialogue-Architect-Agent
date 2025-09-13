//app.jsx

import React, { useState, useEffect } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // "login" | "popup" | "meeting"
  const [meetingData, setMeetingData] = useState(null);
  const [user, setUser] = useState(null);
  const [cookieUserName, setCookieUserName] = useState(null);


  useEffect(() => {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar) return;

    if (page === "popup") {
      // Display full height right side
      Object.assign(toolbar.style, {
        top: "1vh",
        right: "5vh",
        left: "auto",
        transform: "none",
        width: "26%",
        height: "fit-content",

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
        height: "50%",
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


  //hàm này là để lưu username khi login thành công và chuyển sang trang popup nhưng còn sai 
  // (đáng ra phải lấy cookie chứ không lấy user đăng nhập)
  const handleLoginSuccess = (username) => {
    setUser(username); // lưu username
    setPage("popup"); // chuyển sang popup sau login
  };



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
     
      {page === "popup" && (
        <PopupPage
        cookieUserName={cookieUserName} 
          onStartMeeting={(data) => {
            setMeetingData(data );
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

      {/* {page === "meeting" && testMeetingData && (
        <MeetingPage
          meetingData={testMeetingData}
          onBack={() => setPage("popup")}
        />
      )} */}
    </>
  );
}
