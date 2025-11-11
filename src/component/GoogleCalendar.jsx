// src/components/GoogleCalendar.jsx

/// <reference types="chrome" />
import React, { useState } from "react";
import { loadAppToken } from "../api/authGoogleCalendar.js";

const API_BASE = "http://localhost:4000"; // hoặc domain BE của bạn

export default function GoogleCalendar({
  formData,
  setFormData,
  onSaveWithCalendar,
  readOnly,
}) {
  const [loading, setLoading] = useState(false);

  const createEvent = async () => {
    if (readOnly) return;

    try {
      if (!formData.meetingStart || !formData.meetingEnd) {
        alert("Please select meeting start & end time before creating event.");
        return;
      }

      setLoading(true);

      // Lấy app_jwt dùng cho BE (đã được lưu khi login Calendar)
      const stored = await loadAppToken();
      const appToken = stored?.app_token;
      if (!appToken) {
        alert("Please connect Google Calendar first.");
        setLoading(false);
        return;
      }

      // Build attendees
      const attendees = [];
      if (formData.guestEmail) {
        attendees.push({ email: formData.guestEmail });
      }
      if (formData.meetingEmail) {
        // nếu meetingEmail là thread có nhiều email thì tuỳ anh parse thêm
        const trimmed = String(formData.meetingEmail).trim();
        if (trimmed && trimmed.includes("@")) {
          attendees.push({ email: trimmed });
        }
      }

      const payload = {
        summary: formData.title || "AI Dialogue Meeting",
        description:
          formData.meetingGoal ||
          formData.meetingNote ||
          "Created via AI Dialogue Architect Agent",
        start: formData.meetingStart, // ISO
        end: formData.meetingEnd, // ISO
        time_zone: "UTC", // hoặc truyền từ FE nếu có
        attendees,
        location: "",
        calendar_id: "primary",
        create_meet_link: true,
      };

      const res = await fetch(`${API_BASE}/api/calendar/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${appToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error("Create event error:", data);
        alert("Failed to create calendar event.");
        return;
      }

      const { eventId, hangoutLink, event } = data;

      // Cập nhật formData để lưu vào DB cùng block
      setFormData((prev) => ({
        ...prev,
        eventId: eventId || event?.id,
        meetingLink: hangoutLink || event?.hangoutLink || prev.meetingLink,
      }));

      // Nếu muốn: gọi callback để save luôn meeting vào DB
      onSaveWithCalendar && onSaveWithCalendar();

      alert("Calendar event created successfully.");
    } catch (err) {
      console.error("Calendar create error:", err);
      alert("Error creating calendar event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calendar-section">
      {/* Ở đây chỉ render phần chọn thời gian, guest, và nút Create Event */}
      <div className="bm-field">
        <label className="bm-label">Start time</label>
        <input
          type="datetime-local"
          value={formData.meetingStart || ""}
          onChange={(e) =>
            !readOnly &&
            setFormData((prev) => ({ ...prev, meetingStart: e.target.value }))
          }
          className="bm-input"
          disabled={readOnly}
        />
      </div>

      <div className="bm-field">
        <label className="bm-label">End time</label>
        <input
          type="datetime-local"
          value={formData.meetingEnd || ""}
          onChange={(e) =>
            !readOnly &&
            setFormData((prev) => ({ ...prev, meetingEnd: e.target.value }))
          }
          className="bm-input"
          disabled={readOnly}
        />
      </div>

      <div className="bm-field">
        <label className="bm-label">Guest Email (optional)</label>
        <input
          type="email"
          value={formData.guestEmail || ""}
          onChange={(e) =>
            !readOnly &&
            setFormData((prev) => ({ ...prev, guestEmail: e.target.value }))
          }
          className="bm-input"
          disabled={readOnly}
        />
      </div>

      <button
        type="button"
        onClick={createEvent}
        className="bm-btn bm-btn--primary"
        disabled={loading || readOnly}
        style={{ marginTop: 8 }}
      >
        {loading ? "Creating event..." : "Create Calendar Event"}
      </button>

      {formData.meetingLink && (
        <div className="bm-field" style={{ marginTop: 8 }}>
          <label className="bm-label">Meeting Link</label>
          <a
            href={formData.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bm-link"
          >
            {formData.meetingLink}
          </a>
        </div>
      )}
    </div>
  );
}
