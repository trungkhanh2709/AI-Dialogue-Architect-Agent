// PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import "../styles/popupSidebar.css";
import SideBar from "./Sidebar";
import InboxOutlined from "../../public/icons/InboxOutlined.svg";
import InputField from "./InputField";
import GoogleCalendar from "./GoogleCalendar";
import ExpandableTextarea from "./ExpandableTextarea";


export default function PopupWithSidebar({ onSelectBlock, decodedCookieEmail }) {
  const VITE_URL_BACKEND = 'http://localhost:4000';
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
    meetingStart: "",
    meetingDuration: "15", // default 15 minutes
    meetingEnd: "",
    guestEmail: "",
    meetingLink: "", // link Google Calendar event
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
        meetingStart: "",
        meetingDuration: "15", // default 15 minutes
        meetingEnd: "",
        guestEmail: "",
        meetingLink: "", // link Google Calendar event
      });
    }
    setIsEditing(false);
  };


  const handleChange = (e) => {

    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };



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
              meetingStart: formData.meetingStart,
              meetingEnd: formData.meetingEnd,

              meetingLink: formData.meetingLink || "",
              meetingEmail: formData.guestEmail || "",


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

  useEffect(() => {
    if (!formData.meetingStart) return;

    const startDate = new Date(formData.meetingStart);
    if (isNaN(startDate.getTime())) return;

    const duration = parseInt(formData.meetingDuration, 10) || 30;
    const endDate = new Date(startDate.getTime() + duration * 60000);

    setFormData(prev => ({ ...prev, meetingEnd: endDate.toISOString() }));
  }, [formData.meetingStart, formData.meetingDuration]);

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
    setIsEditing(true);
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
            <p>Click View from the sidebar item to start the meeting</p>

          </div>

        ) : (
          <>
            <div className="section-title"></div>
            <InputField
              id="title"
              label="Title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              placeholder="Meeting Title"
              error={errors.title}
              readOnly={!isEditing}
            />
            {formData.meetingLink && (
              <div className="meeting-link">
                <span>Meeting Link: </span>
                <a href={formData.meetingLink} target="_blank" rel="noopener noreferrer">
                  {formData.meetingLink}
                </a>
              </div>
            )}


            <GoogleCalendar formData={formData}
              handleChange={handleChange}
              error={errors}

            />




            <div className="section-title">User A – Your Info</div>
            <InputField
              id="userName"
              label="Your Name"
              type="text"
              value={formData.userName}
              onChange={handleChange}
              placeholder="Your Name"
              error={errors.userName}
              readOnly={!isEditing}
            />
            <InputField
              id="userCompanyName"
              label="Company Name"
              type="text"
              value={formData.userCompanyName}
              onChange={handleChange}
              placeholder="Company Name"
              error={errors.userCompanyName}
              readOnly={!isEditing}
            />
            <ExpandableTextarea
              id="userCompanyServices"
              label="Services"
              placeholder="Enter your services..."
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              readOnly={!isEditing}
            />

            <div className="section-title">User B – Prospect Info</div>
            <InputField
              id="prospectName"
              label="Prospect Name"
              type="text"
              value={formData.prospectName}
              onChange={handleChange}
              error={errors.prospectName}
              readOnly={!isEditing}
            />
            <InputField
              id="customerCompanyName"
              label="Customer Company Name"
              type="text"
              value={formData.customerCompanyName}
              onChange={handleChange}
              error={errors.customerCompanyName}
              readOnly={!isEditing}
            />
<ExpandableTextarea
  id="customerCompanyServices"
  label="Customer Services"
  placeholder="Enter customer services..."
  formData={formData}
  setFormData={setFormData}
  errors={errors}
  readOnly={!isEditing}
/>
            <div className="section-title">Contextual Information</div>
            <ExpandableTextarea
              id="meetingGoal"
              label="Meeting Goal"
              placeholder="Describe your objective clearly (e.g., secure a partnership, schedule a demo, explore collaboration, close a sale)."
              maxRows={5}
              formData={formData}
              setFormData={setFormData}
              errors={errors}
                            readOnly={!isEditing}

            />
            <ExpandableTextarea
              id="meetingEmail"
              label="Email (Optional)"
              placeholder="Copy and paste the entire email thread with the prospect, including your initial outreach"
              maxRows={5}
              formData={formData}
              setFormData={setFormData}
              errors={errors}
                            readOnly={!isEditing}

            />
            <ExpandableTextarea
              id="meetingMessage"
              label="Social Media Message History (Optional)"
              placeholder="Copy and paste any relevant social media conversations (e.g., LinkedIn, Twitter) with the prospect. (Optional)"
              maxRows={5}
              formData={formData}
              setFormData={setFormData}
              errors={errors}
                            readOnly={!isEditing}

            />
            <ExpandableTextarea
              id="meetingNote"
              label="Note (Optional)"
              placeholder="For example, additional information useful for the Agent, such as personality analysis results, BusinessDNA insights, key pain points, potential objections, and relationship history with the prospect, etc."
              maxRows={5}
              formData={formData}
              setFormData={setFormData}
              errors={errors}
                            readOnly={!isEditing}

            />        
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
