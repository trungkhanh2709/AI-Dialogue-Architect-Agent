import { useRef, useEffect, useState } from "react";
import InputField from "./InputField";

const GoogleCalendar = ({ formData, handleChange, error }) => {
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

  const handleGoogleLoginAndCreateEvent = async () => {
    chrome.runtime.sendMessage({ type: "LOGIN_GOOGLE" }, async (res) => {
      if (!res) {
        alert("No response from background");
        return;
      }
      if (res.error) {
        alert("Login failed: " + res.error);
        return;
      }
      
      const accessToken = res.token;
      if (!accessToken) return;
      
      try {
        if (!formData.meetingStart) {
          alert("Please select start time");
          return;
        }
        
        // input datetime-local trả về chuỗi kiểu "2025-09-24T15:30"
        const startDate = new Date(formData.meetingStart);
        
        if (isNaN(startDate.getTime())) {
          alert("Invalid start time");
          return;
        }
        
        const durationMinutes = parseInt(formData.meetingDuration, 10) || 15;
        const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const event = {
          summary: formData.title || "Untitled Meeting",
          
          start: {
            dateTime: startDate.toISOString(),
            timeZone: timeZone,
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone:timeZone,
          },
          attendees: formData.guestEmail ? [{ email: formData.guestEmail }] : [],
        };

        if (formData.guestEmail) {
          event.conferenceData = {
            createRequest: {
              requestId: String(Date.now()),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
        }

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
        console.log("Calendar API response:", data);

        if (!resp.ok) {
          throw new Error(data.error?.message || "Unknown error");
        }

        alert("Event created: " + (data.hangoutLink || data.htmlLink));
      } catch (err) {
        console.error("Calendar API error:", err);
        alert("Calendar API failed: " + err.message);
      }
    });
  };
  return (
    <div className="calendar-section">
      <button
        className="google-calendar-btn"
        onClick={() => setShowCalendarOptions((prev) => !prev)}
      >
        Create in Google Calendar
        <span className={`arrow ${showCalendarOptions ? "open" : ""}`}>v</span>
      </button>

      {showCalendarOptions && (
        <div className={`calendar-options ${showCalendarOptions ? "show" : ""}`}>
          <InputField
            id="meetingStart"
            label="Start Time"
            type="datetime-local"
            value={formData.meetingStart}
            onChange={handleChange}
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

          <InputField
            id="guestEmail"
            label="Guest Email"
            type="email"
            value={formData.guestEmail}
            onChange={handleChange}
            error={error.guestEmail}
          />

          <button
            className="confirm-calendar-btn"
            onClick={handleGoogleLoginAndCreateEvent}
          >
            Confirm & Add to Google Calendar
          </button>
        </div>
      )}
    </div>
  );
};

export default GoogleCalendar;
