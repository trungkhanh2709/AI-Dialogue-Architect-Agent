import React, { useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("meeting"); // mặc định ở popup

  return (
    <>
      {page === "popup" && (
        <PopupPage onStartMeeting={() => setPage("meeting")} />
      )}
      {page === "meeting" && (
        <MeetingPage onBack={() => setPage("popup")} />
      )}
    </>
  );
}
