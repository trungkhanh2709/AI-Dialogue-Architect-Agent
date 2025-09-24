// PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import "../styles/popupSidebar.css";
import SideBar from "./Sidebar";
import InboxOutlined from "../../public/icons/InboxOutlined.svg";

export default function PopupWithSidebar({ onSelectBlock, decodedCookieEmail }) {
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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (selectedBlock) {
      setFormData(selectedBlock);
      setFormVisible(true); // Khi chọn block thì mở form luôn
    }
  }, [selectedBlock]);

  const handleSelectBlock = (block) => {
    setSelectedBlock(block);
    setFormData({
      title: block.blockName,
      userName: block.userNameAndRole || "",
      userCompanyName: block.userCompanyName || "",
      userCompanyServices: block.userCompanyServices || "",
      prospectName: block.prospectName || "",
      customerCompanyName: block.customerCompanyName || "",
      customerCompanyServices: block.customerCompanyServices || "",
      meetingGoal: block.meetingGoal || "",
      meetingEmail: block.meetingEmail || "",
      meetingMessage: block.meetingMessage || "",
      meetingNote: block.meetingNote || "",
    });
    setFormVisible(true);
    setIsEditing(false); // mặc định không edit ngay, chỉ xem
  };

  // Khi nhấn Edit
  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    if (selectedBlock) {
      // reset form về dữ liệu ban đầu của block
      setFormData({
        title: selectedBlock.blockName,
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
      });
    }
    setIsEditing(false);
  };


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


  // Hàm tải lại danh sách blocks từ server

  const fetchBlocks = async () => {
    try {
      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}`
      );
      const data = await res.json();
      const meetings = data.meeting?.meetings || [];
      setBlocks(
        meetings.map((m) => ({
          id: m._id.$oid || m._id,
          name: m.blockName,
          ...m,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

 const handleSave = async () => {
  try {
    if (selectedBlock) {
      // Update existing block
      const meeting_id = selectedBlock._id || selectedBlock.id; // dùng _id từ Mongo
      const payload = {
        meetings: [
          {
            blockName: formData.title || "Untitled Meeting",
            userNameAndRole: formData.userName || "",
            userCompanyName: formData.userCompanyName || "",
            userCompanyServices: formData.userCompanyServices || "",
            prospectName: formData.prospectName || "",
            customerCompanyName: formData.customerCompanyName || "",
            customerCompanyServices: formData.customerCompanyServices || "",
            meetingGoal: formData.meetingGoal || "",
            meetingEmail: formData.meetingEmail || "",
            meetingMessage: formData.meetingMessage || "",
            meetingNote: formData.meetingNote || "",
          },
        ],
      };

      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}/${meeting_id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Update failed:", errorData);
        alert("Failed to update meeting: " + (errorData.detail || res.statusText));
        return;
      }

      await res.json();
      alert("Meeting updated successfully");
    } else {
      // Create new meeting (giữ nguyên code cũ)
      const payload = {
        username: decodedCookieEmail,
        meetings: [
          {
            blockName: formData.title || "Untitled Meeting",
            userNameAndRole: formData.userName || "",
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        console.error("Save failed:", errorData);
        alert("Failed to save meeting: " + (errorData.detail || res.statusText));
        return;
      }

      await res.json();
      alert("Meeting saved successfully");
    }

    // Reload sidebar ngay lập tức
    await fetchBlocks();

    // Reset form
    setSelectedBlock(null);
    setFormData({
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
    setFormVisible(false);
    setIsEditing(false);

  } catch (err) {
    console.error("Error saving meeting:", err);
    alert("Failed to save meeting");
  }
};
const handleDeleteBlock = async (block) => {
  if (!window.confirm("Are you sure you want to delete this meeting?")) return;

  try {
    const res = await fetch(
      `${VITE_URL_BACKEND}/api/meeting_prepare/delete_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}/${block.id}`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const errorData = await res.json();
      alert("Failed to delete: " + (errorData.detail || res.statusText));
      return;
    }

    await res.json();
    alert("Meeting deleted successfully");

    await fetchBlocks(); // reload lại sidebar
    setSelectedBlock(null);
    setFormVisible(false);
  } catch (err) {
    console.error(err);
    alert("Error deleting meeting");
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


  useEffect(() => {
    if (selectedBlock) {
      setFormData({
        title: selectedBlock.blockName,
        userName: selectedBlock.userNameAndRole || "",
        userCompanyName: selectedBlock.userCompanyName || "",
        userCompanyServices: selectedBlock.userCompanyServices || "",
        prospectName: selectedBlock.prospectName || "",
        customerCompanyName: selectedBlock.customerCompanyName || "",
        customerCompanyServices: selectedBlock.customerCompanyServices || "",
        meetingGoal: selectedBlock.meetingGoal || "",
        meetingEmail: selectedBlock.meetingEmail || "",
        meetingMessage: selectedBlock.meetingMessage || "",
        meetingNote: selectedBlock.meetingNote || "",
      });
      setFormVisible(true);
    }
  }, [selectedBlock]);

const handleCreateNew = () => {
  setSelectedBlock(null);
  setFormData({
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
  setFormVisible(true);
};

  return (
    <div className="popup-with-sidebar">
      <div className={`sidebar-wrapper ${sidebarVisible ? "" : "hidden"}`}>
       <SideBar
  blocks={blocks}
  onViewBlock={(block) => {
    setSelectedBlock(block);
    setIsEditing(false); // chỉ view
    setFormVisible(true);
  }}
  onEditBlock={(block) => {
    setSelectedBlock(block);
    setIsEditing(true); // bật edit mode
    setFormVisible(true);
  }}
   onDeleteBlock={handleDeleteBlock}

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
            {renderInput("title", "Title", "text", "Meeting Title")}

            <div className="section-title">User A – Your Info</div>
            {renderInput("userName", "Your Name", "text", "Your Name")}
            {renderInput("userCompanyName", "Company Name", "text", "Company Name")}
            {renderTextarea("userCompanyServices", "Services", "textarea", "Services")}

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
    <button className="cancel-button" onClick={handleCancel}>Cancel</button>
    {isEditing ? (
      <button className="edit-button" onClick={handleSave}>Update</button>
    ) : selectedBlock ? (
      <button className="start-button">Start</button>
    ) : (
      <button className="save-button" onClick={handleSave}>Save</button>
    )}
  </div>
)}




      </div>
    </div>
  );
}
