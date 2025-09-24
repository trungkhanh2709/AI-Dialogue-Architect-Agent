// PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import "../styles/popupSidebar.css";
import SideBar from "./Sidebar";
import InboxOutlined from "../../public/icons/InboxOutlined.svg";

export default function PopupWithSidebar({  onSelectBlock, decodedCookieEmail }) {
  const VITE_URL_BACKEND = 'http://localhost:4000'; //process.env.VITE_URL_BACKEND || 'http://localhost:3000';

const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    userName: "",
    userCompanyName: "",
    userCompanyServices: "",
    prospectName: "",
    customerCompanyName: "",
    customerCompanyServices: "",
    meetingGoal: "",
    meetingEmail: "",
    meetingMessage: "",
    meetingNote: "",
  });
  const [errors, setErrors] = useState({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    if (selectedBlock) {
      setFormData(selectedBlock);
      setFormVisible(true); // Khi chọn block thì mở form luôn
    }
  }, [selectedBlock]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };
 
  const renderInput = (id, label, type = "text", placeholder) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={formData[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );

  const renderTextarea = (id, label, rows = 3) => (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        rows={rows}
        value={formData[id]}
        onChange={handleChange}
        className={errors[id] ? "input-error" : ""}
      />
      {errors[id] && <div className="error-text">{errors[id]}</div>}
    </div>
  );
const sampleData = {
  userName: "John Doe",
  userCompanyName: "Example Corp",
  userCompanyServices: "Software Development, Consulting",
  prospectName: "Jane Smith",
  customerCompanyName: "Client Inc",
  customerCompanyServices: "Marketing, Advertising",
  meetingGoal: "Discuss potential collaboration",
  meetingEmail: "jane.smith@client.com",
  meetingMessage: "Looking forward to our meeting",
  meetingNote: "Prepare pitch deck",
};

// const handleCreateNew = () => {
//     setSelectedBlock(null);
//     setFormData({
//       userName: "",
//       userCompanyName: "",
//       userCompanyServices: "",
//       prospectName: "",
//       customerCompanyName: "",
//       customerCompanyServices: "",
//       meetingGoal: "",
//       meetingEmail: "",
//       meetingMessage: "",
//       meetingNote: "",
//     });
//     setFormVisible(true);
//   };

const handleSave = async () => {
  try {
    const payload = {
      username: decodedCookieEmail, // lấy từ cookieUserName hay context
      meetings: [
        {
          blockName: formData.title || "Untitled Meeting", // blockName ngoài cùng
          
          userNameAndRole: formData.userName || "", // nếu có role thì concat
          userCompanyName: formData.userCompanyName || "",
          userCompanyServices: formData.userCompanyServices || "",
          prospectName: formData.prospectName || "",
          customerCompanyName: formData.customerCompanyName || "",
          customerCompanyServices: formData.customerCompanyServices || "",
          meetingGoal: formData.meetingGoal || "",
          meetingEmail: formData.meetingEmail || "",
          meetingMessage: formData.meetingMessage || "",
          meetingNote: formData.meetingNote || "",
          createdAt: new Date().toISOString(),
        },
      ],
    };

  const res = await fetch(
  `${VITE_URL_BACKEND}/api/meeting_prepare/create_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

if (!res.ok) {
  const errorData = await res.json();
  console.error("Save failed:", errorData);
  alert("Failed to save meeting: " + (errorData.detail || res.statusText));
  return;
}

const data = await res.json();
console.log("Saved:", data);
alert("Meeting saved successfully");

  } catch (err) {
    console.error("Error saving meeting:", err);
    alert("Failed to save meeting");
  }
};
useEffect(() => {
  const fetchBlocks = async () => {
    try {
      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}`
      );
      const data = await res.json();
      const meetings = data.meeting?.meetings || [];
      setBlocks(
        meetings.map(m => ({
          id: m._id.$oid || m._id,
          name: m.blockName,
          ...m
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };
  if (decodedCookieEmail) fetchBlocks();
}, [decodedCookieEmail]);

const handleCreateNew = () => {
  setSelectedBlock(null);
  setFormData(sampleData); // fill bằng data mẫu
  setFormVisible(true);
};
  return (
    <div className="popup-with-sidebar">
      <div className={`sidebar-wrapper ${sidebarVisible ? "" : "hidden"}`}>
       <SideBar
  blocks={blocks} // truyền state blocks từ PopupWithSidebar
  onSelectBlock={(block) => {
    setSelectedBlock(block);
    onSelectBlock(block);
  }}
  onCreateNew={handleCreateNew}
/>

      </div>

      <button
        className={`sidebar-toggle ${sidebarVisible ? "expanded" : "collapsed"}`}
        onClick={() => setSidebarVisible((v) => !v)}
      >
        {sidebarVisible ? "<" : ">"}
      </button>

      <div className="form-wrapper">
        {!formVisible ? (
          <div className="form-placeholder" >
            <img src={InboxOutlined} alt="Inbox" className="icon-inbox" />
            <p>Click to open schedule form</p>
          </div>

        ) : (
          <>
            <div className="section-title"></div>
            {renderInput("title", "Title","text","Meeting Title")}
           
            <div className="section-title">User A – Your Info</div>
            {renderInput("userName", "Your Name","text","Your Name")}
            {renderInput("userCompanyName", "Company Name", "text","Company Name")}
            {renderTextarea("userCompanyServices", "Services", "textarea","Services")}

            <div className="section-title">User B – Prospect Info</div>
            {renderInput("prospectName", "Prospect Name")}
            {renderInput("customerCompanyName", "Customer Company Name")}
            {renderTextarea("customerCompanyServices", "Customer Services")}

            <div className="section-title">Contextual Information</div>
            {renderInput("meetingGoal", "Meeting Goal")}
            {renderInput("meetingEmail", "Email (Optional)", "email")}
            {renderInput("meetingMessage", "Message (Optional)")}
            {renderTextarea("meetingNote", "Note (Optional)")}
          </>
        )}
      {formVisible && (
  <div className="form-actions">
    <button
      className="save-button"
      onClick={() => {
        console.log("Save clicked", formData);
        handleSave();}}
    >
      Save
    </button>
  </div>
)}
      </div>
    </div>
  );
}
