// GoogleCalendar.jsx
import { useRef, useEffect, useState } from "react";
import InputField from "./InputField";
// import "../styles/GoogleCalendar.css";
import ExpandDownIcon from "../assets/Expand_down.svg";
import GoogleCalendarIcon from "../assets/google-calendar.svg";
import EmailInput from "./EmailInput";
import { signInAndGetCalendarToken } from "../api/authGoogleCalendar"; 

const GoogleCalendar = ({ formData, handleChange, error, onSaveWithCalendar, readOnly, currentStep, setCurrentStep, setOpenSections }) => {
  const [showCalendarOptions, setShowCalendarOptions] = useState(readOnly ? true : false);
  const emailInputRef = useRef();
  const [guestEmails, setGuestEmails] = useState([]);

  const [clearInput, setClearInput] = useState(false);

  // Sync guestEmails từ formData.guestEmail khi formData thay đổi
  useEffect(() => {
    if (formData.guestEmail) {
      const emails = formData.guestEmail
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e);
      setGuestEmails(emails);
    } else {
      setGuestEmails([]);
    }
  }, [formData.guestEmail]);

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleChangeMeetingStart = (e) => {
    const localValue = e.target.value; // yyyy-MM-ddTHH:mm
    if (!localValue) return;

    const [datePart, timePart] = localValue.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute] = timePart.split(":").map(Number);

    // tạo date local (user timezone)
    const d = new Date(year, month - 1, day, hour, minute);

    // lưu UTC ISO vào formData
    handleChange({ target: { id: "meetingStart", value: d.toISOString() } });
  };

const goToStep = (step) => {
  setCurrentStep(step);
  setOpenSections([step]);
};

  const formatLocalDateTime = (utcString) => {
    if (!utcString) return "";
    const d = new Date(utcString);
    // lấy local yyyy-MM-ddTHH:mm
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };


  const getDefaultDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15);
    return now.toISOString().slice(0, 16);
  };


const handleGoogleLoginAndCreateEvent = async () => {
  let emailsToSend = [...guestEmails];

  if (emailInputRef.current) {
    const value = emailInputRef.current.value.trim();
    if (value && validateEmail(value) && !guestEmails.includes(value)) {
      emailsToSend.push(value);
      setGuestEmails(emailsToSend);
      setClearInput(true);
    }
  }

  const startISO = formData.meetingStart || new Date().toISOString();
  const startDate = new Date(startISO);
  if (isNaN(startDate.getTime())) {
    alert("Invalid start time");
    return;
  }

  const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  handleChange({ target: { id: "guestEmail", value: emailsToSend.join(", ") } });
  handleChange({ target: { id: "meetingStart", value: startDate.toISOString() } });
  handleChange({ target: { id: "meetingEnd", value: endDate.toISOString() } });

  await createGoogleEventViaBackend(emailsToSend);
  setClearInput(false);
};



const createGoogleEventViaBackend = async (emails) => {
  try {
    // 1) Lấy app_token (JWT của app ai_dialogue_calendar)
    const appToken = await signInAndGetCalendarToken();
    if (!appToken) {
      alert("Cannot get app token for calendar");
      return;
    }

    // 2) Tính start / end
    const startDate = new Date(formData.meetingStart || new Date());
    const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const payload = {
      title: formData.title || "Untitled Meeting",
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      guest_emails: emails,
    };

    // 3) Gửi message cho background, background sẽ fetch BE
    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AI_DIALOGUE_CALENDAR_CREATE",
          app_token: appToken,
          payload,
        },
        (resp) => {
          resolve(resp);
        }
      );
    });

    if (!res || !res.ok) {
      console.error("Create calendar event failed:", res);
      alert("Failed to create Google Calendar event");
      return;
    }

    const data = res.data || {};
    const event = data.event || data || {};

    if (event.hangoutLink) {
      handleChange({ target: { id: "meetingLink", value: event.hangoutLink } });
    }
    if (event.id) {
      handleChange({ target: { id: "eventId", value: event.id } });
    }

    alert(
      "Meeting link created: " +
        (event.hangoutLink || event.htmlLink || "Created successfully")
    );

    if (setCurrentStep && setOpenSections) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setOpenSections([nextStep]);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to create Google Calendar event: " + err.message);
  }
};

const updateGoogleEventViaBackend = async (emails) => {
  if (!formData.eventId) {
    alert("No eventId found, cannot update");
    return;
  }

  try {
    const appToken = await signInAndGetCalendarToken();
    if (!appToken) {
      alert("Cannot get app token for calendar");
      return;
    }

    const startDate = new Date(formData.meetingStart || new Date());
    const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

    const payload = {
      event_id: formData.eventId,
      title: formData.title || "Untitled Meeting",
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      guest_emails: emails,
    };

    const res = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "AI_DIALOGUE_CALENDAR_UPDATE",
          app_token: appToken,
          payload,
        },
        (resp) => {
          resolve(resp);
        }
      );
    });

    if (!res || !res.ok) {
      console.error("Update calendar event failed:", res);
      alert("Failed to update Google Calendar event");
      return;
    }

    const data = res.data || {};
    const event = data.event || data || {};

    alert("Event updated successfully");
    if (event.hangoutLink) {
      handleChange({ target: { id: "meetingLink", value: event.hangoutLink } });
    }

    if (setCurrentStep && setOpenSections) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setOpenSections([nextStep]);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to update Google Calendar event: " + err.message);
  }
};



  return (
    <div className="calendar-section">
      <p className="calendar-label">Schedule a meeting on Google Calendar (Optional)</p>
      <p className="calendar-hint">
        To add an event to Google Calendar, select the date and time, enter guest emails, then click the
        {formData.eventId ? " Login & Update Google Calendar " : " Login & Add to Google Calendar "}
        button below.

      </p>

      <div className={`calendar-options show`}>
        <InputField
          id="meetingStart"
          label="Start Time"
          type="datetime-local"
          value={formData.meetingStart ? formatLocalDateTime(formData.meetingStart) : getDefaultDateTime()}
          onChange={handleChangeMeetingStart}
          error={error.meetingStart}
          readOnly={readOnly}
        />

        <div className="input-group">
          <label htmlFor="meetingDuration">Duration</label>
          <select
            id="meetingDuration"
            value={formData.meetingDuration || "15"}
            onChange={readOnly ? undefined : handleChange}
            disabled={readOnly}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
          </select>
        </div>

        <EmailInput
          label="Guest Emails"
          emails={guestEmails}
          setEmails={(newEmails) => {
            if (!readOnly) {
              setGuestEmails(newEmails);
              handleChange({ target: { id: "guestEmail", value: newEmails.join(", ") } });
            }
          }}
          error={error.guestEmail}
          inputRef={emailInputRef}
          clearTrigger={clearInput}
        />
        {!readOnly && (
     <button
  className="confirm-calendar-btn"
  onClick={() => {
    if (formData.eventId) {
      updateGoogleEventViaBackend(guestEmails);
    } else {
      handleGoogleLoginAndCreateEvent();
    }
  }}
>
  {formData.eventId
    ? "Update Google Calendar (Optional)"
    : "Add to Google Calendar (Optional)"}
</button>


        )}

      </div>

    </div>
  );
};

export default GoogleCalendar;
