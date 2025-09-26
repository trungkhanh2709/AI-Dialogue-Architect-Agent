import { useRef, useEffect, useState } from "react";
import InputField from "./InputField";
import "../styles/GoogleCalendar.css";
import ExpandDownIcon from "../assets/Expand_down.svg";
import GoogleCalendarIcon from "../assets/google-calendar.svg";
import EmailInput from "./EmailInput";

const GoogleCalendar = ({ formData, handleChange, error, onSaveWithCalendar }) => {
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [guestEmails, setGuestEmails] = useState([]);
  const emailInputRef = useRef();
  const [clearInput, setClearInput] = useState(false);



  const validateEmail = (email) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
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

  // Lấy start time từ formData, nếu rỗng thì dùng default
  const startISO = formData.meetingStart || new Date().toISOString();
  const startDate = new Date(startISO);
  if (isNaN(startDate.getTime())) {
    alert("Invalid start time");
    return;
  }

  const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  // Cập nhật formData
  handleChange({ target: { id: "guestEmail", value: emailsToSend.join(", ") } });
  handleChange({ target: { id: "meetingStart", value: startDate.toISOString() } });
  handleChange({ target: { id: "meetingEnd", value: endDate.toISOString() } });

  // Gọi API
  createGoogleEvent(emailsToSend);
  setClearInput(false);
};


const handleChangeMeetingStart = (e) => {
  const localValue = e.target.value; // 'yyyy-MM-ddTHH:mm' local
  const d = new Date(localValue); 
  const utcValue = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  handleChange({ target: { id: "meetingStart", value: utcValue } });
};



  const createGoogleEvent = async (emails) => {
    chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE" }, async (res) => {
      if (!res || res.error) {
        alert(res?.error ? "Login failed: " + res.error : "Login cancelled");
        return;
      }
      const accessToken = res.token;
      if (!accessToken) return;

      // Start time
      const startDate = formData.meetingStart
        ? new Date(formData.meetingStart)
        : new Date(getDefaultDateTime());
      if (isNaN(startDate.getTime())) {
        alert("Invalid start time");
        return;
      }

      // End time
      const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Tạo event với Google Meet
      const event = {
        summary: formData.title || "Untitled Meeting",
        start: { dateTime: startDate.toISOString(), timeZone },
        end: { dateTime: endDate.toISOString(), timeZone },
        attendees: emails.map(email => ({ email })), // nếu rỗng cũng ok
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
          alert("Meeting link created: " + data.hangoutLink);
        } else {
          alert("Meeting created but no Google Meet link returned.");
        }
      } catch (err) {
        console.error(err);
        alert("Failed to create Google Calendar event: " + err.message);
      }
    });
  };



const getDefaultDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const tzOffset = now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() - tzOffset);
  return local.toISOString().slice(0,16);
};

const formatLocalDateTime = (utcString) => {
  const d = new Date(utcString);
  const tzOffset = d.getTimezoneOffset() * 60000; // offset in ms
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().slice(0,16);
};



  return (
    <div className="calendar-section">
      <button
        className="google-calendar-btn"
        onClick={() => setShowCalendarOptions((prev) => !prev)}
      >
        <img
          src={GoogleCalendarIcon}
          alt="Google Calendar"
          className="google-calendar-icon"
        />
        Schedule a meeting in Google Calendar
        <img
          src={ExpandDownIcon}
          alt="expand"
          className={`arrow ${showCalendarOptions ? "open" : ""}`}
        />
      </button>


      {showCalendarOptions && (
        <div className={`calendar-options ${showCalendarOptions ? "show" : ""}`}>
         <InputField
  id="meetingStart"
  label="Start Time"
  type="datetime-local"
  value={formData.meetingStart ? formatLocalDateTime(formData.meetingStart) : getDefaultDateTime()}
  onChange={handleChangeMeetingStart}
  error={error.meetingStart}
/>

          <div className="input-group">
            <label htmlFor="meetingDuration">Duration</label>
            <select
              id="meetingDuration"
              value={formData.meetingDuration}
              onChange={handleChange}
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
              setGuestEmails(newEmails);
              // CẬP NHẬT CHỈ guestEmail, không chạm meetingEmail
              handleChange({ target: { id: "guestEmail", value: newEmails.join(", ") } });
            }}
            error={error.guestEmail}
            inputRef={emailInputRef}
            clearTrigger={clearInput}
          />



          <button
            className="confirm-calendar-btn"
            onClick={handleGoogleLoginAndCreateEvent}
          >

            Login & Add to Google Calendar
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendar;
