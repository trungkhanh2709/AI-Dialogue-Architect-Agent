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
      console.log("firstBlock has nameEl:", Boolean(nameEl0), "textEl:", Boolean(textEl0));
      console.log("firstBlock speaker:", nameEl0?.textContent?.trim() || "(none)");
      console.log("firstBlock text preview:", (textEl0?.textContent || "").slice(0, 120));
    } else {
      console.warn("No caption blocks found. Possible causes: captions OFF, Meet DOM changed, or not rendered yet.");
    }

    // 3) container resolve
    const container =
      document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement;

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
          console.error("Still empty after refresh. Likely captions OFF or selector changed.");
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

        console.log("blocks with (name+text) nodes:", okNodeCount, "/", blocksLater.length);

        if (okNodeCount === 0) {
          console.warn("Blocks exist but expected nodes missing. Meet DOM structure likely changed.");
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
    document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement || null;

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
      document.querySelector("div.nMcdL.bj4p3b")?.parentElement?.parentElement || null;

    if (!container) {
      const diagFail = _meetDomDiagnostics();
      sendResponse({
        ok: false,
        reason: "Caption container not found (selector div.nMcdL.bj4p3b -> parentElement.parentElement = null)",
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
