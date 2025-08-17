import React, { useState } from "react";
import PopupPage from "./pages/PopupPage.jsx";
import MeetingPage from "./pages/MeetingPage.jsx";

export default function App() {
  const [page, setPage] = useState("popup"); // mặc định ở popup
  const [meetingData, setMeetingData] = useState({}); // state lưu dữ liệu từ popup
const sampleMeetingData = {
  userCompanyName: "GYMZ Việt Nam",
  userCompanyServices: "Cung cấp gói tập gym, thực phẩm bổ sung, và thiết bị thể hình",
  
  customerCompanyName: "Công ty ABC Tech",
  customerCompanyServices: "Giải pháp phần mềm cho doanh nghiệp",

  meetingGoal: "Giới thiệu gói tập doanh nghiệp & chương trình ưu đãi hợp tác",
  
  meetingEmail: `
Kính gửi anh/chị,

Em là Khánh từ GYMZ Việt Nam. Bên em hiện đang triển khai gói tập gym dành riêng cho nhân viên doanh nghiệp, 
giúp tăng cường sức khỏe và tinh thần làm việc. Khi đăng ký cho đội ngũ từ 10 người trở lên, anh/chị sẽ nhận được 
ưu đãi giảm 20% phí thành viên, kèm theo gói tập thử miễn phí trong 7 ngày. 

Rất mong được hẹn lịch để chia sẻ chi tiết hơn và lắng nghe nhu cầu của công ty mình.

Trân trọng,  
Khánh - GYMZ Việt Nam
  `,

  meetingMessage: "Xin chào anh/chị, hôm nay em muốn chia sẻ về chương trình hợp tác doanh nghiệp của GYMZ.",
  meetingNote: "Khách hàng quan tâm đến phúc lợi cho nhân viên, cần nhấn mạnh lợi ích về sức khỏe & tinh thần."
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
      {page === "meeting" && (
        <MeetingPage meetingData={sampleMeetingData} onBack={() => setPage("popup")} />
      )}
    </>
  );
}
