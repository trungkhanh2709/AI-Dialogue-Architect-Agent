let latestCaptions = [];
let sharedCaptions = [];
let startTime = null;
let timerInterval = null;
const timeRemainingThreshold = 30 * 60;
const urlConnect = `https://accounts.google.com/o/oauth2/auth?client_id=242934590241-su4r9eepcub5q56c5cupee44lbsfal51.apps.googleusercontent.com&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/calendar`;
// const VITE_URL_BACKEND = "https://api-as.reelsightsai.com";
const VITE_URL_BACKEND = "http://localhost:4000";

function resetTimer() {
  startTime = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  if (!startTime) startTime = Date.now();
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "TIMER_UPDATE", payload: { minutes, seconds } },
          () => {}
        );
      });
    });

    if (elapsedSeconds >= timeRemainingThreshold) {
      clearInterval(timerInterval);
      timerInterval = null;
      chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "SESSION_EXPIRED" },
            () => {}
          );
        });
      });
    }
  }, 1000);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background received message:", msg);
  switch (msg.type) {
    case "RESET_TIMER":
      resetTimer();
      sendResponse({ ok: true });
      return true;

    case "START_TIMER":
      startTimer();
      return true;

    case "GET_TIMER":
      if (!startTime) {
        sendResponse({ minutes: 0, seconds: 0 });
      } else {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        sendResponse({
          minutes: Math.floor(elapsedSeconds / 60),
          seconds: elapsedSeconds % 60,
        });
      }
      return true;

    case "NEW_CAPTION":
      latestCaptions = msg.payload;
      return true;

    case "GET_CAPTIONS":
      sendResponse({ data: latestCaptions });
      return true;

    case "LIVE_TRANSCRIPT":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        chrome.tabs.sendMessage(tabs[0].id, msg);
      });
      return true;

    case "LOGIN_GOOGLE":
      chrome.identity.launchWebAuthFlow(
        { url: urlConnect, interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            sendResponse({
              error: chrome.runtime.lastError?.message || "Login failed",
            });
            return;
          }
          const m = redirectUrl.match(/access_token=([^&]+)/);
          sendResponse({ token: m ? m[1] : null });
        }
      );
      return true;

    case "GET_REMAIN_SESSIONS":
      const { email, add_on_type } = msg.payload;
      fetch(`${VITE_URL_BACKEND}/api/addons/get_addon_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, add_on_type }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("GET_REMAIN_SESSIONS response:", data);
          sendResponse({ data });
        })
        .catch((err) => sendResponse({ data: null, error: err.message }));
      return true;

    case "USE_ADDON_SESSION":
      const { email: userEmail, add_on_type: addonType } = msg.payload;
      fetch(`${VITE_URL_BACKEND}/api/addons/use_addon_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, add_on_type: addonType }),
      })
        .then((res) => res.json())
        .then((data) => sendResponse({ data }))
        .catch((err) => sendResponse({ data: null, error: err.message }));
      return true;

    case "GET_MEETING_PREPARE":
      const { email: meetingEmail } = msg.payload;
      fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
          meetingEmail
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.meeting) {
            sendResponse({ data: { meeting: { meetings: [] } } });
          } else {
            sendResponse({ data });
          }
        })
        .catch((err) =>
          sendResponse({
            data: { meeting: { meetings: [] } },
            error: err.message,
          })
        );

      return true; // giữ sendResponse mở

    case "UPDATE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, meetingId, payload } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(
              email
            )}/${meetingId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meetings: [payload] }),
            }
          );

          if (!res.ok) throw new Error("Update failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });

          // update local state: fetch lại blocks
          const res2 = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
              email
            )}`
          );
          const newData = await res2.json();
          chrome.runtime.sendMessage({
            type: "REFRESH_BLOCKS",
            payload: newData.meeting?.meetings || [],
          });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "DELETE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, meetingId } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/delete_meeting_prepare/${encodeURIComponent(
              email
            )}/${meetingId}`,
            { method: "DELETE" }
          );

          if (!res.ok) throw new Error("Delete failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });

          // Sau khi xoá thì fetch lại danh sách mới
          const res2 = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
              email
            )}`
          );
          const newData = await res2.json();
          chrome.runtime.sendMessage({
            type: "REFRESH_BLOCKS",
            payload: newData.meeting?.meetings || [],
          });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "CREATE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, payload } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/create_meeting_prepare/${encodeURIComponent(
              email
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: email, meetings: [payload] }),
            }
          );

          if (!res.ok) throw new Error("Create failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "SEND_MESSAGE_TO_AGENT":
      (async function() {
        try {
          // Kiểm tra tab Google Meet active
          chrome.tabs.query(
            {
              url: "https://meet.google.com/*",
              active: true,
              currentWindow: true,
            },
            async (tabs) => {
              if (!tabs.length) {
                sendResponse({ error: "Not on a Google Meet tab" });
                return;
              }

              const { meetingData, chatHistory, log } = msg.payload;

              const payload = {
                ...meetingData, // toàn bộ fields từ handleSave
                meetingLog: Array.isArray(log)
                  ? log.join("\n")
                  : String(log || ""),
                msg: Array.isArray(chatHistory) ? chatHistory : [],
              };

              try {
                const response = await fetch(
                  `${VITE_URL_BACKEND}/api/content-generators/ai_dialogue_architect_agent`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  }
                );

                const data = await response.json();
                sendResponse({ data });
              } catch (err) {
                sendResponse({ error: err.message });
              }
            }
          );
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "SEND_MESSAGE_TO_AGENT_STREAM":
      (async () => {
        try {
          chrome.tabs.query(
            {
              url: "https://meet.google.com/*",
              active: true,
              currentWindow: true,
            },
            async (tabs) => {
              if (!tabs.length) {
                sendResponse({ error: "Not on a Google Meet tab" });
                return;
              }

              const activeTabId = tabs[0].id;
              const { meetingData, chatHistory, log, requestId } = msg.payload;

              const payload = {
                ...meetingData,
                meetingLog: Array.isArray(log)
                  ? log.join("\n")
                  : String(log || ""),
                msg: Array.isArray(chatHistory) ? chatHistory : [],
              };

              const res = await fetch(
                `${VITE_URL_BACKEND}/api/content-generators/ai_dialogue_architect_agent_stream`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }
              );

              if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "");
                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_ERROR",
                  payload: text || `HTTP ${res.status}`,
                  requestId,
                });
                sendResponse({ ok: false, error: text });
                return;
              }

              // báo cho FE là stream đã start (optional)
              chrome.tabs.sendMessage(activeTabId, {
                type: "AGENT_STREAM_START",
                payload: { requestId },
              });

              const reader = res.body.getReader();
              const decoder = new TextDecoder("utf-8");

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });

                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_CHUNK",
                  payload: { delta: chunk, requestId },
                });
              }

              // báo end
              chrome.tabs.sendMessage(activeTabId, {
                type: "AGENT_STREAM_DONE",
                payload: { requestId },
              });

              sendResponse({ ok: true });
            }
          );
        } catch (err) {
          console.error("[SEND_MESSAGE_TO_AGENT_STREAM] error:", err);
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;

    case "SEND_FILLER_REQUEST":
      (async () => {
        try {
          // đảm bảo đang ở tab Meet
          chrome.tabs.query(
            {
              url: "https://meet.google.com/*",
              active: true,
              currentWindow: true,
            },
            async (tabs) => {
              if (!tabs.length) {
                sendResponse({ ok: false, error: "Not on a Google Meet tab" });
                return;
              }

              const activeTabId = tabs[0].id;
              const { meetingData, log } = msg.payload;

              const payload = {
                ...meetingData,
                meetingLog: Array.isArray(log)
                  ? log.join("\n")
                  : String(log || ""),
              };

              const res = await fetch(
                `${VITE_URL_BACKEND}/api/ai_dialogue_architect_agent/filler`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }
              );

              const raw = await res.text();
              let data;
              try {
                data = JSON.parse(raw);
              } catch {
                data = raw;
              }

              // tuỳ BE trả về field nào, chỉnh lại cho đúng
              const fillerText =
                data?.filler || data?.text || data?.content || data;

              // bắn về content script (MeetingPage) để show lên ChatUI
              chrome.tabs.sendMessage(activeTabId, {
                type: "AGENT_FILLER",
                payload: { text: fillerText },
              });

              sendResponse({ ok: true, data });
            }
          );
        } catch (err) {
          console.error("[SEND_FILLER_REQUEST] error:", err);
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;

      case "SAVE_MEETING_TRANSCRIPT":
  (async function () {
    try {
      let { email, meetingId, transcriptText, transcriptId } = msg.payload;
      if (!meetingId) {
        sendResponse({ error: "Missing meetingId" });
        return;
      }

      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/upsert_transcript/${encodeURIComponent(
          email
        )}/${meetingId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meeting_transcript: transcriptText,
            transcript_id: transcriptId || null,
          }),
        }
      );

      if (!res.ok) throw new Error("Save meeting failed");

      const data = await res.json();
      sendResponse({ data });

      // fetch lại list meeting + REFRESH_BLOCKS
      try {
        const res2 = await fetch(
          `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
            email
          )}`
        );
        const newData = await res2.json();
        chrome.runtime.sendMessage({
          type: "REFRESH_BLOCKS",
          payload: newData.meeting?.meetings || [],
        });
      } catch (err2) {
        console.warn("[SAVE_MEETING_TRANSCRIPT] refresh blocks failed:", err2);
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true;


    case "SALE_PROSPECT_REQUEST":
      (async () => {
        try {
          const { payload } = msg;
          const url = `${VITE_URL_BACKEND}/api/sale/prospect`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(payload?.username ? { username: payload.username } : {}),
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          // ✅ trả thẳng về cho sender (UI) qua callback
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();

      return true;

    case "BUSINESS_DNA_REQUEST":
      (async () => {
        try {
          const { payload } = msg;
          const url = `${VITE_URL_BACKEND}/api/sale/business-dna`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(payload?.username ? { username: payload.username } : {}),
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_ME":
      (async () => {
        try {
          const { app_token } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          // 1) Lấy Google access_token cho app ai_dialogue_calendar
          const tokRes = await fetch(
            `${VITE_URL_BACKEND}/api/oauth2/google/token?app=ai_dialogue_calendar`,
            {
              headers: {
                Authorization: `Bearer ${app_token}`,
              },
            }
          );

          if (!tokRes.ok) {
            const t = await tokRes.text().catch(() => "");
            console.warn("[AI_DIALOGUE_ME] /token failed:", tokRes.status, t);
            sendResponse({ ok: false, status: tokRes.status, error: t });
            return;
          }

          const tok = await tokRes.json().catch(() => ({}));
          const access_token = tok.access_token;
          if (!access_token) {
            console.warn("[AI_DIALOGUE_ME] /token no access_token:", tok);
            sendResponse({
              ok: false,
              status: 500,
              error: "No access_token from /token",
            });
            return;
          }

          // 2) Gọi Google UserInfo để lấy profile (name/email/picture)
          const uiRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
              headers: { Authorization: `Bearer ${access_token}` },
            }
          );

          if (!uiRes.ok) {
            const t = await uiRes.text().catch(() => "");
            console.warn("[AI_DIALOGUE_ME] userinfo failed:", uiRes.status, t);
            sendResponse({ ok: false, status: uiRes.status, error: t });
            return;
          }

          const user = await uiRes.json();

          sendResponse({
            ok: true,
            status: 200,
            user,
          });
        } catch (err) {
          console.warn("[AI_DIALOGUE_ME] exception:", err);
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_CREATE":
      (async () => {
        try {
          const { app_token, payload } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/create`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${app_token}`, // 👈 chính là app_token
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_CREATE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_UPDATE":
      (async () => {
        try {
          const { app_token, payload } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/update`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${app_token}`,
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_UPDATE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_DELETE":
      (async () => {
        try {
          const { app_token, event_id } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }
          if (!event_id) {
            sendResponse({
              ok: false,
              status: 400,
              error: "Missing event_id",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/event/${encodeURIComponent(
            event_id
          )}`;

          const res = await fetch(url, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${app_token}`,
            },
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          console.log("[AI_DIALOGUE_CALENDAR_DELETE] BE response:", data);
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_DELETE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;


    
    default:
      if (msg.action === "pushCaption") {
        sharedCaptions.push(msg.data);
      } else if (msg.action === "getCaptions") {
        sendResponse({ captions: sharedCaptions });
        return true;
      } else if (msg.action === "CHECK_COOKIE") {
        chrome.cookies.get(
          { url: "https://reelsightsai.com/dashboard", name: "username" },
          (cookie) => {
            sendResponse(
              cookie
                ? { loggedIn: true, username: cookie.value }
                : { loggedIn: false }
            );
          }
        );
        return true;
      }
      return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["main.js"],
  });
});
