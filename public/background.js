let latestCaptions = [];
let sharedCaptions = [];
let startTime = null;
let timerInterval = null;
const timeRemainingThreshold = 30 * 60;
const urlConnect = `https://accounts.google.com/o/oauth2/auth?client_id=242934590241-su4r9eepcub5q56c5cupee44lbsfal51.apps.googleusercontent.com&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/calendar`;
const VITE_URL_BACKEND = 'http://localhost:4000';

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
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: "TIMER_UPDATE", payload: { minutes, seconds } }, () => {});
      });
    });

    if (elapsedSeconds >= timeRemainingThreshold) {
      clearInterval(timerInterval);
      timerInterval = null;
      chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: "SESSION_EXPIRED" }, () => {});
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
        sendResponse({ minutes: Math.floor(elapsedSeconds / 60), seconds: elapsedSeconds % 60 });
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
      chrome.identity.launchWebAuthFlow({ url: urlConnect, interactive: true }, (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          sendResponse({ error: chrome.runtime.lastError?.message || "Login failed" });
          return;
        }
        const m = redirectUrl.match(/access_token=([^&]+)/);
        sendResponse({ token: m ? m[1] : null });
      });
      return true;

    case "GET_REMAIN_SESSIONS":
      const { email, add_on_type } = msg.payload;
      fetch(`${VITE_URL_BACKEND}/api/addons/get_addon_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, add_on_type })
      })
      .then(res => res.json())
     .then(data => {
    console.log("GET_REMAIN_SESSIONS response:", data);
    sendResponse({ data });
  })
      .catch(err => sendResponse({ data: null, error: err.message }));
      return true;

    default:
      if (msg.action === "pushCaption") {
        sharedCaptions.push(msg.data);
      } else if (msg.action === "getCaptions") {
        sendResponse({ captions: sharedCaptions });
        return true;
      } else if (msg.action === "CHECK_COOKIE") {
        chrome.cookies.get({ url: "https://reelsightsai.com/dashboard", name: "username" }, (cookie) => {
          sendResponse(cookie ? { loggedIn: true, username: cookie.value } : { loggedIn: false });
        });
        return true;
      }
      return true;
  }
});

chrome.action.onClicked.addListener(tab => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["main.js"],
  });
});
