
let latestCaptions = [];
let sharedCaptions = [];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "NEW_CAPTION") {
    latestCaptions = message.payload;
  } else if (message.type === "GET_CAPTIONS") {
    sendResponse({ data: latestCaptions });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LIVE_TRANSCRIPT") {
    chrome.runtime.sendMessage(message); // gửi cho popup
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
