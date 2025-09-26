// GoogleCalendar.jsx
import { useRef, useEffect, useState } from "react";
import InputField from "./InputField";
import "../styles/GoogleCalendar.css";
import ExpandDownIcon from "../assets/Expand_down.svg";
import GoogleCalendarIcon from "../assets/google-calendar.svg";
import EmailInput from "./EmailInput";

const GoogleCalendar = ({ formData, handleChange, error, onSaveWithCalendar,readOnly  }) => {
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

    createGoogleEvent(emailsToSend);
    setClearInput(false);
  };

  const createGoogleEvent = async (emails) => {
    chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE" }, async (res) => {
      if (!res || res.error) {
        alert(res?.error ? "Login failed: " + res.error : "Login cancelled");
        return;
      }
      const accessToken = res.token;
      if (!accessToken) return;

      const startDate = new Date(formData.meetingStart || new Date());
      const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const event = {
        summary: formData.title || "Untitled Meeting",
        start: { dateTime: startDate.toISOString(), timeZone },
        end: { dateTime: endDate.toISOString(), timeZone },
        attendees: emails.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: String(Date.now()),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      try {
        const resp = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(event),
          }
        );
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error?.message || "Unknown error");

        if (data.hangoutLink) {
          handleChange({ target: { id: "meetingLink", value: data.hangoutLink } });
          handleChange({ target: { id: "eventId", value: data.id } });
          alert("Meeting link created: " + data.hangoutLink);
          if (onSaveWithCalendar) onSaveWithCalendar({ resetForm: false });
        } else {
          alert("Meeting created but no Google Meet link returned.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to create Google Calendar event: " + err.message);
      }
    });
  };

  const updateGoogleEvent = async (emails) => {
  chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE" }, async (res) => {
    if (!res || res.error) {
      alert(res?.error ? "Login failed: " + res.error : "Login cancelled");
      return;
    }
    const accessToken = res.token;
    if (!accessToken) return;

    if (!formData.eventId) {
      alert("No eventId found, cannot update");
      return;
    }

    const startDate = new Date(formData.meetingStart || new Date());
    const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const event = {
      summary: formData.title || "Untitled Meeting",
      start: { dateTime: startDate.toISOString(), timeZone },
      end: { dateTime: endDate.toISOString(), timeZone },
      attendees: emails.map((email) => ({ email })),
    };

    try {
      const resp = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${formData.eventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || "Unknown error");

      alert("Event updated successfully");
      if (data.hangoutLink) {
        handleChange({ target: { id: "meetingLink", value: data.hangoutLink } });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update Google Calendar event: " + err.message);
    }
  });
};

  return (
    <div className="calendar-section">
      <button
        className="google-calendar-btn"
        onClick={() => {  if (!readOnly) setShowCalendarOptions((prev) => !prev);}}
      >
        <img src={GoogleCalendarIcon} alt="Google Calendar" className="google-calendar-icon" />
        Schedule a meeting in Google Calendar
        <img src={ExpandDownIcon} alt="expand" className={`arrow ${showCalendarOptions ? "open" : ""}`} />
      </button>

      {showCalendarOptions && (
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
             } }}
            error={error.guestEmail}
            inputRef={emailInputRef}
            clearTrigger={clearInput}
          />
 {!readOnly && (
  <button
    className="confirm-calendar-btn"
    onClick={() => {
      if (formData.eventId) {
        updateGoogleEvent(guestEmails);
      } else {
        handleGoogleLoginAndCreateEvent();
      }
    }}
  >
    {formData.eventId
      ? "Login & Update Google Calendar"
      : "Login & Add to Google Calendar"}
  </button>
)}

        </div>
      )}
    </div>
  );
};

export default GoogleCalendar;
