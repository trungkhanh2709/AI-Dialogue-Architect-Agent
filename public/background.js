//background.js
let latestCaptions = [];
let sharedCaptions = [];
let startTime = null; // thời điểm bắt đầu
let timerInterval = null;
const timeRemainingThreshold = 30 * 60; // 30- phút
const urlConnect = `https://accounts.google.com/o/oauth2/auth?client_id=242934590241-su4r9eepcub5q56c5cupee44lbsfal51.apps.googleusercontent.com&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/calendar`;

function resetTimer() {
  startTime = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  if (!startTime) {
    startTime = Date.now();
  }
  if (!timerInterval) {
    timerInterval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;

      // Gửi lên các tab có Chat UI
      chrome.tabs.query({url: "https://meet.google.com/*"}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: "TIMER_UPDATE",
            payload: { minutes, seconds },
          },()=>{
              if (chrome.runtime.lastError) {}
          });
        });
      });

      // Sau 30 phút thông báo
      if (elapsedSeconds >= timeRemainingThreshold) {
        clearInterval(timerInterval);
        timerInterval = null;

       
        // Thêm payload báo session expired
        chrome.tabs.query({url: "https://meet.google.com/*"}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: "SESSION_EXPIRED",
            },()=>{
                if (chrome.runtime.lastError) {}
            });
          });
        });
      }
    }, 1000);
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RESET_TIMER") {
    resetTimer();
    sendResponse({ ok: true });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_TIMER") {
    startTimer();
  } else if (message.type === "GET_TIMER") {
    if (!startTime) return sendResponse({ minutes: 0, seconds: 0 });
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    sendResponse({
      minutes: Math.floor(elapsedSeconds / 60),
      seconds: elapsedSeconds % 60,
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_CAPTION") {
    latestCaptions = message.payload;
  } else if (message.type === "GET_CAPTIONS") {
    sendResponse({ data: latestCaptions });
  }
});

// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LIVE_TRANSCRIPT") {
    // Forward message tới tab đang active
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return;
      chrome.tabs.sendMessage(tabs[0].id, message);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "pushCaption") {
    sharedCaptions.push(message.data);
  } else if (message.action === "getCaptions") {
    sendResponse({ captions: sharedCaptions });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["main.js"], // file build từ injectToolbar.js
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "CHECK_COOKIE") {
    chrome.cookies.get(
      { url: "https://reelsightsai.com/dashboard", name: "username" },
      (cookie) => {
        if (cookie) {
        console.log("Cookie username:", cookie.value); // log username từ cookie

          sendResponse({ loggedIn: true, username: cookie.value });
        } else {
          sendResponse({ loggedIn: false });
        }
      }
    );
    return true; // keep sendResponse async
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "LOGIN_GOOGLE") {
    chrome.identity.launchWebAuthFlow(
      {
        url: urlConnect,
        interactive: true
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          sendResponse({ error: chrome.runtime.lastError?.message || "Login failed" });
          return;
        }
        const m = redirectUrl.match(/access_token=([^&]+)/);
        const token = m ? m[1] : null;
        sendResponse({ token });
      }
    );
    return true; // GIỮ CHANNEL
  }
});


