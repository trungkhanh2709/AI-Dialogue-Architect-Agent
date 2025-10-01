// PopupWithSidebar.jsx
import React, { useState, useEffect } from "react";
import "../styles/popupSidebar.css";
import SideBar from "./Sidebar";
import InboxOutlined from "../assets/InboxOutlined.svg";
import InputField from "./InputField";
import GoogleCalendar from "./GoogleCalendar";
import ExpandableTextarea from "./ExpandableTextarea";
import CollapsibleSection from "./CollapsibleSection";

export default function PopupWithSidebar({ onStartMeeting, onSelectBlock, decodedCookieEmail }) {
  const VITE_URL_BACKEND = 'https://api-as.reelsightsai.com';
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

  const [currentStep, setCurrentStep] = useState(1);
  const [openSections, setOpenSections] = useState([1]);

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
        eventId: "", // link Google Calendar event
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


  const handleSave = async ({ resetForm = true } = {}) => {
    try {
      if (!formData.title) formData.title = "Untitled Meeting";

      const payloadMeeting = {
        blockName: formData.title,
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
        meetingStart: formData.meetingStart || "",
        meetingDuration: formData.meetingDuration || "15",
        meetingEnd: formData.meetingEnd || "",
        meetingLink: formData.meetingLink || "",
        eventId: formData.eventId || "",
        guestEmail: formData.guestEmail || "",
        createdAt: selectedBlock ? selectedBlock.createdAt : new Date().toISOString(),
      };

      if (selectedBlock) {
        // Update
        const meeting_id = selectedBlock._id || selectedBlock.id;
        const res = await fetch(
          `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}/${meeting_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetings: [payloadMeeting] }),
          }
        );
        if (!res.ok) throw new Error("Update failed");
      } else {
        // Create new
        const res = await fetch(
          `${VITE_URL_BACKEND}/api/meeting_prepare/create_meeting_prepare/${encodeURIComponent(decodedCookieEmail)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: decodedCookieEmail, meetings: [payloadMeeting] }),
          }
        );
        if (!res.ok) throw new Error("Create failed");
      }

      await fetchBlocks();
      if (resetForm) {
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
          guestEmail: "",
          meetingMessage: "",
          meetingNote: "",
          meetingStart: "",
          meetingDuration: "15",
          meetingEnd: "",
          meetingLink: "",
        });
        setFormVisible(false);
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
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
        title: selectedBlock.blockName || "",
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
        meetingStart: selectedBlock.meetingStart || "",
        meetingDuration: selectedBlock.meetingDuration || "15",
        meetingEnd: selectedBlock.meetingEnd || "",
        guestEmail: selectedBlock.guestEmail || "",
        meetingLink: selectedBlock.meetingLink || "",   // <<< THÊM VÀO
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


  const handleStart = async () => {
    try {
      const res = await fetch(`${VITE_URL_BACKEND}/api/addons/use_addon_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: decodedCookieEmail,
          add_on_type: "ai_dialogue_architect_agent"
        })
      });

      const data = await res.json();

      chrome.runtime.sendMessage({ type: "RESET_TIMER" }, () => {
        chrome.runtime.sendMessage({ type: "START_TIMER" });

      });

      if (data.trial_used === true || data.status === "200") {
        onStartMeeting({
          ...formData,
          id: selectedBlock?.id,
          _id: selectedBlock?.id, // ép luôn cho MeetingPage dùng được
        });

      } else {
        alert("You have run out of sessions. Please purchase an add-on to continue.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while calling the API");
    }
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
          setSidebarVisible={setSidebarVisible}
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
            {formData.meetingLink && (
              <div className="meeting-link">

                <a href={formData.meetingLink} target="_blank" rel="noopener noreferrer">
                  {formData.meetingLink}
                </a>
              </div>
            )}
  <CollapsibleSection
              step={1}
              title="Step 1: Meeting Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}

              openSections={openSections}
              setOpenSections={setOpenSections}
            >

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
             <GoogleCalendar
                formData={formData}
                handleChange={handleChange}
                error={errors}
                onSaveWithCalendar={handleSave} // thêm callback
                readOnly={!isEditing}
                 currentStep={currentStep}      
  setCurrentStep={setCurrentStep} 
  setOpenSections={setOpenSections}
              />

            </CollapsibleSection>
            <CollapsibleSection
              step={2}
              title="Step 2: User A – Your Info"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}
              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <InputField
                id="userName"
                label="Your Name and Role/Title:"
                type="text"
                value={formData.userName}
                onChange={handleChange}
                placeholder="Your Name and Role/Title:"
                error={errors.userName}
                readOnly={!isEditing}
              />
              <InputField
                id="userCompanyName"
                label="Your Company Name"
                type="text"
                value={formData.userCompanyName}
                onChange={handleChange}
                placeholder="Your Company Name"
                error={errors.userCompanyName}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="userCompanyServices"
                label="Your Company – Industry, Products, and Services"
                placeholder="Please provide clear information about your company, including Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />

            </CollapsibleSection>

            <CollapsibleSection
              step={3}
              title="Step 3: User B – Prospect Info"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}

              openSections={openSections}
              setOpenSections={setOpenSections}
            >



              <InputField
                id="prospectName"
                label="Prospect's Name - Role/Title"
                type="text"
                value={formData.prospectName}
                onChange={handleChange}
                placeholder="Prospect's Name - Role/Title"
                error={errors.prospectName}
                readOnly={!isEditing}
              />
              <InputField
                id="customerCompanyName"
                label="Prospect Company Name"
                type="text"
                placeholder="Prospect Company Name"
                value={formData.customerCompanyName}
                onChange={handleChange}
                error={errors.customerCompanyName}
                readOnly={!isEditing}
              />
              <ExpandableTextarea
                id="customerCompanyServices"
                label="Prospect Company – Industry, Products, Services"
                placeholder="Please provide clear information about your prospect company, including its Industry, Products/Services, Target Audience, Market Position, Website Link, News/Press Releases, etc."
                formData={formData}
                setFormData={setFormData}
                errors={errors}
                readOnly={!isEditing}
              />

            </CollapsibleSection>


            <CollapsibleSection
              step={4}
              title="Step 4: Contextual Information"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}

              openSections={openSections}
              setOpenSections={setOpenSections}
            >

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
            </CollapsibleSection>

            <CollapsibleSection
              step={5}
              title="Step 5: Schedule a meeting on Google Calendar (Optional)"
              currentStep={currentStep}
              setCurrentStep={setCurrentStep}

              openSections={openSections}
              setOpenSections={setOpenSections}
            >
              <GoogleCalendar
                formData={formData}
                handleChange={handleChange}
                error={errors}
                onSaveWithCalendar={handleSave} // thêm callback
                readOnly={!isEditing}
              />

            </CollapsibleSection>




          </>
        )}
        {formVisible && (
          <div className="form-actions">
            <button className="cancel-button" onClick={handleCancel}>Cancel</button>
            {!selectedBlock ? (
              <button className="save-button" onClick={handleSave}>Save</button>
            ) : isEditing ? (
              <button className="edit-button" onClick={handleSave}>Update</button>
            ) : (
              <button className="start-button" onClick={handleStart}>Start</button>
            )}
          </div>
        )}





      </div>
    </div>
  );
}
