console.log("🔍 Google Meet Caption Logger — Started v3.6.12");

let currentSpeech = {}; // speaker → phần live đang nói
let speakerTimers = {}; // speaker → timeout id
let meeting_log = []; // câu đã finalize
let lastFinalized = {}; // speaker → toàn bộ câu cuối cùng đã lưu
const SPEAKER_TIMEOUT = 2000; // 1.0s im lặng => finalize
let lastFinalizedWords = {}; // speaker -> array các từ đã finalize

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

  const deltaText = getDeltaText(speaker, sentence);
  if (!deltaText) return;

  chrome.runtime.sendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: deltaText },
  });

  // Xóa live
  delete currentSpeech[speaker];

  // Cập nhật lastFinalizedWords local luôn
  lastFinalizedWords[speaker] = [...(lastFinalizedWords[speaker] || []), ...deltaText.split(/\s+/)];
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
  const newWords = cleanMessage(newText).split(/\s+/);
  const finalizedWords = lastFinalizedWords[speaker] || [];

  // Lọc ra các từ chưa xuất hiện
  const deltaWords = newWords.filter((word) => !finalizedWords.includes(word));

  return deltaWords.join(" ");
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

console.log("⏳ Waiting for caption container...");