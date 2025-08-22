
let latestCaptions = [];
let sharedCaptions = [];

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
  if (message.action === 'pushCaption') {
    sharedCaptions.push(message.data);
  } else if (message.action === 'getCaptions') {
    sendResponse({ captions: sharedCaptions });
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['main.js'] // file build từ injectToolbar.js
  });
});
