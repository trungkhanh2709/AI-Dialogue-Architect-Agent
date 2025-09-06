//background.js
let latestCaptions = [];
let sharedCaptions = [];
let startTime = null; // thời điểm bắt đầu
let timerInterval = null;
const timeRemainingThreshold = 0.1 * 60; // 5 phút

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
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, {
            type: "TIMER_UPDATE",
            payload: { minutes, seconds },
          });
        });
      });

      // Sau 30 phút thông báo
      if (elapsedSeconds >= timeRemainingThreshold) {
        clearInterval(timerInterval);
        timerInterval = null;

       
        // Thêm payload báo session expired
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            chrome.tabs.sendMessage(tab.id, {
              type: "SESSION_EXPIRED",
            });
          });
        });
      }
    }, 1000);
  }
}
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

