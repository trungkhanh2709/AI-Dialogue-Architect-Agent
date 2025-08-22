

console.log("🔍 Google Meet Caption Logger — Started v3.6.12");

let currentSpeech = {}; // speaker → phần live đang nói
let speakerTimers = {}; // speaker → timeout id
let meeting_log = []; // câu đã finalize
let lastFinalized = {}; // speaker → toàn bộ câu cuối cùng đã lưu
const SPEAKER_TIMEOUT = 2000; // 1.0s im lặng => finalize
let lastFinalizedWords = {}; // speaker -> array các từ đã finalize
let lastFinalizedText = {}; // speaker → toàn bộ text đã finalize








function cleanMessage(msg) {
  return msg.trim().replace(/\s+/g, " ");
}

function sendUpdateLive() {
  try {
    chrome.runtime.sendMessage({
      type: "LIVE_TRANSCRIPT",
      payload: { action: "update_live", currentSpeech },
    });
  } catch (err) {
    console.warn("⚠️ sendUpdateLive failed:", err);
  }
}

// Loại bỏ phần trùng lặp với câu đã finalize trước đó
function removeRepeatedPart(speaker, newText) {
  const oldText = lastFinalized[speaker] || "";
  if (!oldText) return newText;

  // Nếu newText chứa oldText ở đầu => chỉ lấy phần sau
  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();

  // Nếu newText chứa oldText ở đâu đó => cắt phần trước oldText
  const index = newText.indexOf(oldText);
  if (index >= 0) return newText.slice(index + oldText.length).trim();

  return newText; // nếu không trùng
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

  // Tìm delta mới: bỏ những từ đã finalize
  let deltaStart = 0;
  while (deltaStart < oldWords.length && deltaStart < newWords.length && oldWords[deltaStart] === newWords[deltaStart]) {
    deltaStart++;
  }

  const deltaText = newWords.slice(deltaStart).join(" ");
  if (!deltaText) return;

  // Gửi delta mới
  chrome.runtime.sendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: deltaText },
  });

  // Cập nhật lastFinalizedWords
  lastFinalizedWords[speaker] = newWords;

  // Xóa live speech
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

  // Nếu newText chứa oldText ở đầu => chỉ lấy phần sau
  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();

  return newText; // nếu không trùng prefix
}

function initObserver(container) {
  if (window._captionObserver) window._captionObserver.disconnect();
  window._captionObserver = new MutationObserver(handleCaptions);
  window._captionObserver.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  console.log("✅ Real-time caption streaming activated!");
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





console.log("Waiting for caption container...");