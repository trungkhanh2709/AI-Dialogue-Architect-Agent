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
    chrome.runtime.sendMessage(
      {
        type: "LIVE_TRANSCRIPT",
        payload: { action: "update_live", currentSpeech },
      },
      () => {
        if (chrome.runtime.lastError) {
        }
      },
    );
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


function getDelta(prev, curr) {
  if (!prev) return curr;

  const prevWords = prev.split(/\s+/);
  const currWords = curr.split(/\s+/);

  let i = 0;

  // so theo WORD (không phải char)
  while (
    i < prevWords.length &&
    i < currWords.length &&
    prevWords[i] === currWords[i]
  ) {
    i++;
  }

  return currWords.slice(i).join(" ").trim();
}


function finalizeSentence(speaker, sentence) {
  if (!sentence) return;

  const prev = lastFinalizedText[speaker] || "";

  const delta = getDelta(prev, sentence);

  if (!delta || delta.length < 2) return;

  chrome.runtime.sendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: delta },
  });

  lastFinalizedText[speaker] = sentence;
}

function getCaptionBlocks() {
  const container = document.querySelector('[aria-label="Captions"]');
  if (!container) return [];

  return Array.from(container.children).filter(el => {
    return el.innerText && el.innerText.length > 0;
  });
}

function extractSpeakerAndText(block) {
  const bold = block.querySelector("b");
  if (!bold) return null;

  const speakerRaw = bold.textContent || "";
  const fullText = block.textContent || "";

  const speaker = speakerRaw.replace(":", "").trim();

  // remove speaker khỏi text
  let text = fullText.replace(speakerRaw, "").trim();

  // clean duplicate
  text = text.replace(speaker, "").trim();

  if (!speaker || !text) return null;

  return { speaker, text };
}
function isValidCaptionBlock(el) {
  if (!el) return false;

  // phải có text
  const text = el.innerText?.trim();
  if (!text) return false;

  // caption thường ngắn
  const words = text.split(/\s+/);
  if (words.length < 3 || words.length > 50) return false;

  // loại UI noise
  const noisePatterns = [
    "Press the down arrow",
    "mute",
    "camera",
    "settings",
    "More options",
    "Meeting",
    "reaction",
    "Turn on",
    "You can't"
  ];

  for (let p of noisePatterns) {
    if (text.includes(p)) return false;
  }

  return true;
}

function extractFromBlock(block) {
  if (!block) return null;

  // ưu tiên đúng structure của Google Meet
  let speakerEl =
    block.querySelector('[class*="NWp"]') ||
    block.querySelector("span");

  let textEl =
    block.querySelector('[class*="ygicle"]') ||
    block.querySelector("div:last-child");

  if (!speakerEl || !textEl) return null;

  const speaker = speakerEl.innerText.trim();
  const text = textEl.innerText.trim();

  if (!speaker || !text) return null;

  // filter trường hợp bị đảo ngược (rất quan trọng)
  if (text.length < speaker.length) return null;

  return { speaker, text };
}

function handleCaptions() {
  const blocks = getCaptionBlocks();

  blocks.forEach((block) => {
    const result = extractFromBlock(block);
    if (!result) return;

    const { speaker, text } = result;

    const fullMessage = cleanMessage(text);

    // tránh spam giống nhau
    if (currentSpeech[speaker] === fullMessage) return;

    currentSpeech[speaker] = fullMessage;

    if (speakerTimers[speaker]) clearTimeout(speakerTimers[speaker]);

   const capturedText = fullMessage;

speakerTimers[speaker] = setTimeout(() => {
  // chỉ finalize nếu text không đổi
  if (currentSpeech[speaker] === capturedText) {
    finalizeSentence(speaker, capturedText);
  }
}, SPEAKER_TIMEOUT);
  });
}





function getDeltaText(speaker, newText) {
  const oldText = lastFinalizedText[speaker] || "";
  if (!oldText) return newText;

  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();

  return newText;
}
let rafScheduled = false;

function initObserver(container) {
  if (window._captionObserver) window._captionObserver.disconnect();

  window._captionObserver = new MutationObserver(() => {
    if (rafScheduled) return;

    rafScheduled = true;
    requestAnimationFrame(() => {
      handleCaptions();
      rafScheduled = false;
    });
  });

  window._captionObserver.observe(container, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function waitForCaptionContainer() {
  const container =
    document.querySelector('[aria-label="Captions"]') ||
     document.querySelector('[aria-label="Phụ đề"]') ||
    document.querySelector('[role="region"]');

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "REFRESH_CAPTION_DOM") return;

  const ts = new Date().toISOString();
  const logPrefix = `[REFRESH_CAPTION_DOM ${ts}]`;

  try {
    console.groupCollapsed(`${logPrefix} start`);
    console.log("url:", location.href);
    console.log("sessionExpired:", sessionExpired);

    // 1) raw query blocks
    const blocksNow = document.querySelectorAll("div.nMcdL.bj4p3b");
    console.log("blocksNow.length:", blocksNow?.length || 0);

    // 2) check first block structure
    if (blocksNow && blocksNow.length > 0) {
      const b0 = blocksNow[0];
      const nameEl0 = b0.querySelector("span.NWpY1d");
      const textEl0 = b0.querySelector("div.ygicle.VbkSUe");
      console.log(
        "firstBlock has nameEl:",
        Boolean(nameEl0),
        "textEl:",
        Boolean(textEl0),
      );
      console.log(
        "firstBlock speaker:",
        nameEl0?.textContent?.trim() || "(none)",
      );
      console.log(
        "firstBlock text preview:",
        (textEl0?.textContent || "").slice(0, 120),
      );
    } else {
      console.warn(
        "No caption blocks found. Possible causes: captions OFF, Meet DOM changed, or not rendered yet.",
      );
    }

    // 3) container resolve
    const container = document.querySelector("div.nMcdL.bj4p3b")?.parentElement
      ?.parentElement;

    console.log("container found:", Boolean(container));
    if (container) {
      console.log("container tag:", container.tagName);
      console.log("container class:", container.className);
    }

    if (!container) {
      console.error("Caption container not found (selector returned null).");
      console.groupEnd();
      sendResponse({ ok: false, error: "Caption container not found" });
      return;
    }

    // 4) init observer
    console.log("initObserver() called");
    initObserver(container);

    // 5) verify again after 500ms
    setTimeout(() => {
      try {
        const blocksLater = document.querySelectorAll("div.nMcdL.bj4p3b");
        console.log("verify blocksLater.length:", blocksLater?.length || 0);

        if (!blocksLater || blocksLater.length === 0) {
          console.error(
            "Still empty after refresh. Likely captions OFF or selector changed.",
          );
          console.groupEnd();
          sendResponse({ ok: false, error: "Caption blocks still empty" });
          return;
        }

        // extra deep check
        let okNodeCount = 0;
        blocksLater.forEach((b) => {
          const hasName = Boolean(b.querySelector("span.NWpY1d"));
          const hasText = Boolean(b.querySelector("div.ygicle.VbkSUe"));
          if (hasName && hasText) okNodeCount++;
        });

        console.log(
          "blocks with (name+text) nodes:",
          okNodeCount,
          "/",
          blocksLater.length,
        );

        if (okNodeCount === 0) {
          console.warn(
            "Blocks exist but expected nodes missing. Meet DOM structure likely changed.",
          );
        }

        console.log("Refresh OK ✅");
        console.groupEnd();
        sendResponse({ ok: true, count: blocksLater.length, okNodeCount });
      } catch (e) {
        console.error("Verify step error:", e);
        console.groupEnd();
        sendResponse({ ok: false, error: String(e) });
      }
    }, 500);
  } catch (err) {
    console.error("Refresh exception:", err);
    try {
      console.groupEnd();
    } catch {}
    sendResponse({ ok: false, error: String(err) });
  }

  return true; // async response
});
// ===== ADD: Refresh caption observer on demand + detailed diagnostics =====
function _meetDomDiagnostics() {
  const blocks = document.querySelectorAll("div.nMcdL.bj4p3b");
  const nameEls = document.querySelectorAll("span.NWpY1d");
  const textEls = document.querySelectorAll("div.ygicle.VbkSUe");
  const container =
    document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement ||
    null;

  return {
    url: location.href,
    ts: Date.now(),
    blocksCount: blocks.length,
    nameElsCount: nameEls.length,
    textElsCount: textEls.length,
    containerFound: Boolean(container),
    containerTag: container ? container.tagName : null,
    containerClass: container ? container.className : null,
    observerExists: Boolean(window._captionObserver),
    sessionExpired: Boolean(sessionExpired),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "REFRESH_CAPTION_OBSERVER") return;

  try {
    const diagBefore = _meetDomDiagnostics();

    // thử tìm lại container
    const container =
      document.querySelector("div.nMcdL.bj4p3b")?.parentElement
        ?.parentElement || null;

    if (!container) {
      const diagFail = _meetDomDiagnostics();
      sendResponse({
        ok: false,
        reason:
          "Caption container not found (selector div.nMcdL.bj4p3b -> parentElement.parentElement = null)",
        diagnostics: { before: diagBefore, after: diagFail },
      });
      return true;
    }

    // re-init observer (reuse existing function)
    initObserver(container);

    const diagAfter = _meetDomDiagnostics();

    // quick sanity: run 1 scan immediately
    try {
      handleCaptions();
    } catch (e2) {
      sendResponse({
        ok: false,
        reason: `handleCaptions threw error: ${String(e2)}`,
        diagnostics: { before: diagBefore, after: diagAfter },
      });
      return true;
    }

    sendResponse({
      ok: true,
      reason: "Observer re-attached",
      diagnostics: { before: diagBefore, after: diagAfter },
    });
  } catch (e) {
    sendResponse({
      ok: false,
      reason: `REFRESH_CAPTION_OBSERVER exception: ${String(e)}`,
      diagnostics: { failSafe: _meetDomDiagnostics() },
    });
  }

  return true;
});
