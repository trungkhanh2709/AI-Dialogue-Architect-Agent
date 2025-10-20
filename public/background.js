let latestCaptions = [];
let sharedCaptions = [];
let startTime = null;
let timerInterval = null;
const timeRemainingThreshold = 30 * 60;
const urlConnect = `https://accounts.google.com/o/oauth2/auth?client_id=242934590241-su4r9eepcub5q56c5cupee44lbsfal51.apps.googleusercontent.com&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/calendar`;
const VITE_URL_BACKEND = "https://api-as.reelsightsai.com";
// const VITE_URL_BACKEND = "http://localhost:4000";

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
                userName: meetingData.userName,
                userCompanyName: meetingData.userCompanyName,
                userCompanyServices: meetingData.userCompanyServices,
                prospectName: meetingData.prospectName,
                customerCompanyName: meetingData.customerCompanyName,
                customerCompanyServices: meetingData.customerCompanyServices,
                meetingGoal: meetingData.meetingGoal,
                meetingEmail: meetingData.meetingEmail,
                meetingMessage: meetingData.meetingMessage,
                meetingNote: meetingData.meetingNote,
                meetingLog: log.join("\n"),
                msg: chatHistory,
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

case "SAVE_MEETING_TRANSCRIPT":
  (async function() {
    try {
      let { email, meetingId, payloadMeeting } = msg.payload;
      if (!meetingId) {
        sendResponse({ error: "Missing meetingId" });
        return;
      }

      // Ép _id trong payload về string
      payloadMeeting = {
        ...payloadMeeting,
        _id: meetingId.toString(),
      };

      const res = await fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(
          email
        )}/${meetingId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetings: [payloadMeeting] }),
        }
      );

      if (!res.ok) throw new Error("Save meeting failed");

      const data = await res.json();
      sendResponse({ data });
    } catch (err) {
      sendResponse({ error: err.message });
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
