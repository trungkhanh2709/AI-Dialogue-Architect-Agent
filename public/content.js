//content.js
console.log("🔍 Google Meet Caption Logger — Started v3.6.12");

let currentSpeech = {}; // speaker → currently speaking part
let speakerTimers = {}; // speaker
let meeting_log = []; //  finalize sentences
let lastFinalized = {}; // speaker → the entire last finalized sentence
const SPEAKER_TIMEOUT = 2000; 
let lastFinalizedWords = {}; // speaker -> array of finalized words
let lastFinalizedText = {}; // speaker → full finalized text
let sessionExpired = false;

function cleanMessage(msg) {
  return msg.trim().replace(/\s+/g, " ");
}

function sendUpdateLive() {
  try {
    chrome.runtime.sendMessage({
      type: "LIVE_TRANSCRIPT",
      payload: { action: "update_live", currentSpeech },
    },()=>{
      if (chrome.runtime.lastError) {}
    });
  } catch (err) {
    console.warn("⚠️ sendUpdateLive failed:", err);
  }
}
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_EXPIRED") {
    console.log("Session expired, stopping caption observer...");
    sessionExpired = true;


  }
});
// Remove duplicate parts from the previously finalized sentence
function removeRepeatedPart(speaker, newText) {
  const oldText = lastFinalized[speaker] || "";
  if (!oldText) return newText;

// If newText starts with oldText => take only the remaining part
  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();

// If newText contains oldText somewhere => remove the part before oldText
  const index = newText.indexOf(oldText);
  if (index >= 0) return newText.slice(index + oldText.length).trim();

  return newText; 
}
function finalizeSpeech(speaker) {
  const message = currentSpeech[speaker];
  if (!message) return;

  meeting_log.push(`${speaker}: "${message}"`);
  delete currentSpeech[speaker];
  sendUpdateLive();
}

function finalizeSentence(speaker, sentence) {
  if (!sentence) return;

  const oldWords = lastFinalizedWords[speaker] || [];
  const newWords = sentence.trim().split(/\s+/);

// Find the new delta: remove words that have already been finalized
  let deltaStart = 0;
  while (deltaStart < oldWords.length && deltaStart < newWords.length && oldWords[deltaStart] === newWords[deltaStart]) {
    deltaStart++;
  }

  const deltaText = newWords.slice(deltaStart).join(" ");
  if (!deltaText) return;

  // Send new delta
  chrome.runtime.sendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: deltaText },
  });

  // Update lastFinalizedWords
  lastFinalizedWords[speaker] = newWords;

  // Delete live speech
  delete currentSpeech[speaker];
}




function handleCaptions() {
  const captionBlocks = document.querySelectorAll("div.nMcdL.bj4p3b");
  captionBlocks.forEach((block) => {
    const nameEl = block.querySelector("span.NWpY1d");
    const textEl = block.querySelector("div.ygicle.VbkSUe");
    if (!nameEl || !textEl) return;
    
    const speaker = nameEl.textContent.trim();
    const fullMessage = cleanMessage(textEl.textContent);
    currentSpeech[speaker] = fullMessage;

    if (speakerTimers[speaker]) clearTimeout(speakerTimers[speaker]);
    speakerTimers[speaker] = setTimeout(() => {
      finalizeSentence(speaker, currentSpeech[speaker]);
    }, SPEAKER_TIMEOUT);
  });
}

const observer = new MutationObserver(handleCaptions);
const container = document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement;
if (container) observer.observe(container, { childList: true, subtree: true, characterData: true });

function getDeltaText(speaker, newText) {
  const oldText = lastFinalizedText[speaker] || "";
  if (!oldText) return newText;

  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();

  return newText; 
}

function initObserver(container) {
  if (window._captionObserver) window._captionObserver.disconnect();
  window._captionObserver = new MutationObserver(handleCaptions);
  window._captionObserver.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function waitForCaptionContainer() {
  const container = document.querySelector("div.nMcdL.bj4p3b")?.parentElement
    ?.parentElement;
  if (container) {
    initObserver(container);
    return true;
  }
  return false;
}

const finder = setInterval(() => {
  if (waitForCaptionContainer()) clearInterval(finder);
}, 300);

if (window.location.hostname === "meet.google.com") {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("toolbar.js");
  script.type = "module";
  (document.head || document.documentElement).appendChild(script);
}
