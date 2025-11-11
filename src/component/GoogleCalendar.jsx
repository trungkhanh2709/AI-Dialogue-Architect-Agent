// import { useRef, useEffect, useState } from "react";
// import InputField from "./InputField";
// import EmailInput from "./EmailInput";
// import {
//   ensureSignedIn,
//   getShortLivedGoogleAccessToken,
//   get
// } from "../api/authGoogle";

// const GoogleCalendar = ({
//   formData,
//   handleChange,
//   error,
//   onSaveWithCalendar,
//   readOnly,
//   currentStep,
//   setCurrentStep,
//   setOpenSections,
// }) => {
//   const [guestEmails, setGuestEmails] = useState([]);
//   const emailInputRef = useRef(null);
//   const [clearInput, setClearInput] = useState(false);

//   // Sync guestEmails từ formData.guestEmail
//   useEffect(() => {
//     if (formData && formData.guestEmail) {
//       const emails = String(formData.guestEmail)
//         .split(",")
//         .map((e) => e.trim())
//         .filter(Boolean);
//       setGuestEmails(emails);
//     } else {
//       setGuestEmails([]);
//     }
//   }, [formData && formData.guestEmail]);

//   const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

//   const handleChangeMeetingStart = (e) => {
//     const localValue = e.target.value; // yyyy-MM-ddTHH:mm (local)
//     if (!localValue) return;

//     const [datePart, timePart] = localValue.split("T");
//     if (!datePart || !timePart) return;

//     const [year, month, day] = datePart.split("-").map((n) => parseInt(n, 10));
//     const [hour, minute] = timePart.split(":").map((n) => parseInt(n, 10));

//     const d = new Date(year, month - 1, day, hour, minute);
//     if (isNaN(d.getTime())) return;

//     handleChange({
//       target: { id: "meetingStart", value: d.toISOString() },
//     });
//   };

//   const formatLocalDateTime = (utcString) => {
//     if (!utcString) return "";
//     const d = new Date(utcString);
//     if (isNaN(d.getTime())) return "";
//     const pad = (n) => String(n).padStart(2, "0");
//     return (
//       d.getFullYear() +
//       "-" +
//       pad(d.getMonth() + 1) +
//       "-" +
//       pad(d.getDate()) +
//       "T" +
//       pad(d.getHours()) +
//       ":" +
//       pad(d.getMinutes())
//     );
//   };

//   const getDefaultDateTime = () => {
//     const now = new Date();
//     now.setMinutes(now.getMinutes() + 15);
//     const pad = (n) => String(n).padStart(2, "0");
//     return (
//       now.getFullYear() +
//       "-" +
//       pad(now.getMonth() + 1) +
//       "-" +
//       pad(now.getDate()) +
//       "T" +
//       pad(now.getHours()) +
//       ":" +
//       pad(now.getMinutes())
//     );
//   };

//   const goNextStep = () => {
//     if (!setCurrentStep || !setOpenSections) return;
//     const next = (currentStep || 1) + 1;
//     setCurrentStep(next);
//     setOpenSections([next]);
//   };

//   const handleGoogleLoginAndCreateEvent = async () => {
//     // Gom email từ list + input hiện tại
//     let emails = guestEmails.slice();

//     if (emailInputRef.current) {
//       const value = emailInputRef.current.value.trim();
//       if (value && validateEmail(value) && !emails.includes(value)) {
//         emails.push(value);
//         setGuestEmails(emails);
//         setClearInput(true);
//       }
//     }

//     const startISO =
//       (formData && formData.meetingStart) || new Date().toISOString();
//     const startDate = new Date(startISO);
//     if (isNaN(startDate.getTime())) {
//       alert("Invalid start time");
//       return;
//     }

//     const dur = parseInt(formData.meetingDuration || "15", 10) || 15;
//     const endDate = new Date(startDate.getTime() + dur * 60000);

//     // Cập nhật vào formData
//     handleChange({
//       target: { id: "guestEmail", value: emails.join(", ") },
//     });
//     handleChange({
//       target: { id: "meetingStart", value: startDate.toISOString() },
//     });
//     handleChange({
//       target: { id: "meetingEnd", value: endDate.toISOString() },
//     });

//     try {
//       // 1) Đảm bảo đã login (app_jwt cho ai_dialogue_calendar)
//       await ensureSignedIn();

//       // 2) Lấy access_token Google Calendar ngắn hạn từ BE
//       const accessToken = await getShortLivedCalendarAccessToken();

//       // 3) Tạo event
//       await createGoogleEventWithToken(accessToken, emails);
//       setClearInput(false);
//     } catch (err) {
//       console.error(err);
//       alert(
//         err && err.message
//           ? err.message
//           : "Failed to create Google Calendar event"
//       );
//     }
//   };

//   const createGoogleEventWithToken = async (accessToken, emails) => {
//     const startDate = new Date(
//       (formData && formData.meetingStart) || new Date()
//     );
//     const dur = parseInt(formData.meetingDuration || "15", 10) || 15;
//     const endDate = new Date(startDate.getTime() + dur * 60000);
//     const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

//     const event = {
//       summary: formData.title || "Untitled Meeting",
//       start: { dateTime: startDate.toISOString(), timeZone },
//       end: { dateTime: endDate.toISOString(), timeZone },
//       attendees: emails.map((email) => ({ email })),
//       conferenceData: {
//         createRequest: {
//           requestId: String(Date.now()),
//           conferenceSolutionKey: { type: "hangoutsMeet" },
//         },
//       },
//     };

//     const resp = await fetch(
//       "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
//       {
//         method: "POST",
//         headers: {
//           Authorization: "Bearer " + accessToken,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(event),
//       }
//     );

//     const data = await resp.json().catch(() => ({}));
//     if (!resp.ok) {
//       throw new Error(
//         (data &&
//           data.error &&
//           (data.error.message || data.error_description)) ||
//           "Google Calendar API error"
//       );
//     }

//     if (data.hangoutLink) {
//       handleChange({
//         target: { id: "meetingLink", value: data.hangoutLink },
//       });
//       handleChange({ target: { id: "eventId", value: data.id } });
//       alert("Meeting link created: " + data.hangoutLink);
//       goNextStep();
//     } else {
//       alert("Meeting created but no Google Meet link returned.");
//     }
//   };

//   const updateGoogleEvent = async (emails) => {
//     if (!formData.eventId) {
//       alert("No eventId found, cannot update");
//       return;
//     }

//     try {
//       // 1) Đảm bảo login
//       await ensureSignedIn();

//       // 2) Lấy access_token
//       const accessToken = await getShortLivedCalendarAccessToken();

//       const startDate = new Date(
//         (formData && formData.meetingStart) || new Date()
//       );
//       const dur = parseInt(formData.meetingDuration || "15", 10) || 15;
//       const endDate = new Date(startDate.getTime() + dur * 60000);
//       const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

//       const event = {
//         summary: formData.title || "Untitled Meeting",
//         start: { dateTime: startDate.toISOString(), timeZone },
//         end: { dateTime: endDate.toISOString(), timeZone },
//         attendees: emails.map((email) => ({ email })),
//       };

//       const resp = await fetch(
//         `https://www.googleapis.com/calendar/v3/calendars/primary/events/${formData.eventId}`,
//         {
//           method: "PATCH",
//           headers: {
//             Authorization: "Bearer " + accessToken,
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(event),
//         }
//       );

//       const data = await resp.json().catch(() => ({}));
//       if (!resp.ok) {
//         throw new Error(
//           (data &&
//             data.error &&
//             (data.error.message || data.error_description)) ||
//             "Google Calendar API error"
//         );
//       }

//       alert("Event updated successfully");
//       if (data.hangoutLink) {
//         handleChange({
//           target: { id: "meetingLink", value: data.hangoutLink },
//         });
//       }
//       goNextStep();
//     } catch (err) {
//       console.error(err);
//       alert(
//         "Failed to update Google Calendar event: " +
//           (err && err.message ? err.message : "")
//       );
//     }
//   };

//   return (
//     <div className="calendar-section">
//       <p className="calendar-label">
//         Schedule a meeting on Google Calendar (Optional)
//       </p>
//       <p className="calendar-hint">
//         Select date & time, enter guest emails, then connect Google Calendar to
//         auto-create the event & Meet link.
//       </p>

//       <div className="calendar-options show">
//         <InputField
//           id="meetingStart"
//           label="Start Time"
//           type="datetime-local"
//           value={
//             formData.meetingStart
//               ? formatLocalDateTime(formData.meetingStart)
//               : getDefaultDateTime()
//           }
//           onChange={handleChangeMeetingStart}
//           error={error.meetingStart}
//           readOnly={readOnly}
//         />

//         <div className="input-group">
//           <label htmlFor="meetingDuration">Duration</label>
//           <select
//             id="meetingDuration"
//             value={formData.meetingDuration || "15"}
//             onChange={readOnly ? undefined : handleChange}
//             disabled={readOnly}
//           >
//             <option value="15">15 minutes</option>
//             <option value="30">30 minutes</option>
//             <option value="60">1 hour</option>
//           </select>
//         </div>

//         <EmailInput
//           label="Guest Emails"
//           emails={guestEmails}
//           setEmails={(newEmails) => {
//             if (!readOnly) {
//               setGuestEmails(newEmails);
//               handleChange({
//                 target: { id: "guestEmail", value: newEmails.join(", ") },
//               });
//             }
//           }}
//           error={error.guestEmail}
//           inputRef={emailInputRef}
//           clearTrigger={clearInput}
//         />

//         {!readOnly && (
//           <button
//             className="confirm-calendar-btn"
//             onClick={() => {
//               if (formData.eventId) {
//                 updateGoogleEvent(guestEmails);
//               } else {
//                 handleGoogleLoginAndCreateEvent();
//               }
//             }}
//           >
//             {formData.eventId
//               ? "Login & Update Google Calendar (Optional)"
//               : "Login & Add to Google Calendar (Optional)"}
//           </button>
//         )}
//       </div>
//     </div>
//   );
// };

// export default GoogleCalendar;
