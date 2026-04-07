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
let captionDetectedNotified = false;
let deepContainersCache = [];
let lastDeepScanAt = 0;
let liveRegionCache = new WeakMap();
let lastCaptionSeenAt = 0;
let lastLiveRegionSeenAt = 0;

function isInsideExtensionUI(node) {
  if (!node) return false;
  try {
    if (node.closest && node.closest("#__ai_dialogue_toolbar__")) return true;
    const root = node.getRootNode ? node.getRootNode() : null;
    if (root?.host?.id === "__ai_dialogue_toolbar__") return true;
  } catch {}
  return false;
}

function cleanMessage(msg) {
  return msg.trim().replace(/\s+/g, " ");
}

function safeSendMessage(message, callback) {
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(message, (res) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (typeof callback === "function") callback(res);
    });
  } catch (err) {
    console.warn("safeSendMessage failed:", err);
  }
}

function sendUpdateLive() {
  safeSendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "update_live", currentSpeech },
  });
}

function reportContentError(payload) {
  safeSendMessage({
    type: "REPORT_ERROR",
    payload: {
      source: "content",
      url: location.href,
      ...payload,
    },
  });
}

function collectShadowRoots(root) {
  const roots = [];
  const stack = [root];
  const seen = new Set();

  while (stack.length) {
    const node = stack.pop();
    if (!node || seen.has(node)) continue;
    seen.add(node);
    roots.push(node);

    if (node.querySelectorAll) {
      const elements = node.querySelectorAll("*");
      elements.forEach((el) => {
        if (el.shadowRoot && !seen.has(el.shadowRoot)) {
          stack.push(el.shadowRoot);
        }
      });
    }
  }

  return roots;
}

function queryAllDeep(selector, root = document) {
  const results = [];
  const roots = collectShadowRoots(root);
  roots.forEach((r) => {
    if (!r || !r.querySelectorAll) return;
    r.querySelectorAll(selector).forEach((el) => results.push(el));
  });
  return results;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_EXPIRED") {
    console.log("Session expired, stopping caption observer...");
    sessionExpired = true;
  }
});

window.addEventListener("error", (event) => {
  reportContentError({
    event: "content_error",
    message: event?.message || "Content script error",
    stack: event?.error?.stack || "",
  });
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  reportContentError({
    event: "content_unhandled_rejection",
    message:
      (reason && (reason.message || String(reason))) ||
      "Unhandled promise rejection",
    stack: reason?.stack || "",
  });
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
  if (isSystemCaptionText(speaker, sentence)) return;

  const prev = lastFinalizedText[speaker] || "";

  const delta = getDelta(prev, sentence);

  if (!delta || delta.length < 2) return;

  safeSendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: delta },
  });

  lastFinalizedText[speaker] = sentence;
}

function getCaptionContainers() {
  const containers = new Set();

  document
    .querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
    .forEach((el) => containers.add(el));
  document
    .querySelectorAll("[data-captions-display]")
    .forEach((el) => containers.add(el));
  document.querySelectorAll('[role="log"]').forEach((el) => containers.add(el));
  document
    .querySelectorAll(
      '[aria-label*="Captions"], [aria-label*="captions"], [aria-label*="Subtitles"], [aria-label*="subtitles"]',
    )
    .forEach((el) => containers.add(el));
  document.querySelectorAll('[jscontroller="KPn5nb"]').forEach((el) => {
    containers.add(el);
  });

  const knownBlocks = document.querySelectorAll("div.nMcdL.bj4p3b");
  knownBlocks.forEach((b) => {
    if (isInsideExtensionUI(b)) return;
    const c = b?.parentElement?.parentElement;
    if (c) containers.add(c);
  });

  const outer = document.querySelector(
    "#yDmH0d > c-wiz > div > div > div.TKU8Od > div.crqnQb > div > div:nth-child(1) > div.fJsklc.nulMpf.Didmac.G03iKb.hLkVuf",
  );
  if (outer) {
    containers.add(outer);
    const captionRegion = outer.querySelector(
      '[aria-label*="Captions"], [aria-label*="captions"], [jscontroller="KPn5nb"], div.vNKgIf.UDinHf',
    );
    if (captionRegion) containers.add(captionRegion);
  }

  const explicitCaptionRegion = document.querySelector(
    'div.vNKgIf.UDinHf[aria-label="Captions"]',
  );
  if (explicitCaptionRegion) containers.add(explicitCaptionRegion);

  const now = Date.now();
  if (now - lastDeepScanAt > 2000) {
    lastDeepScanAt = now;
    deepContainersCache = queryAllDeep(
      '[aria-live="polite"], [aria-live="assertive"], [data-captions-display], [role="log"], [jscontroller="KPn5nb"], [aria-label*="captions"], [aria-label*="Captions"], [aria-label*="Subtitles"], [aria-label*="subtitles"]',
    );
  }

  deepContainersCache.forEach((el) => {
    if (isInsideExtensionUI(el)) return;
    containers.add(el);
  });

  return Array.from(containers).filter((el) => el);
}

function isSystemCaptionText(speaker, text) {
  const t = `${speaker || ""} ${text || ""}`.toLowerCase();
  if (
    t.includes("closed_caption_off") ||
    t.includes("closed captions off") ||
    t.includes("live captions have been turned off") ||
    t.includes("captions have been turned off") ||
    t.includes("live captions have been turned on") ||
    t.includes("captions have been turned on")
  ) {
    return true;
  }
  if (
    t.includes("open caption settings") ||
    t.includes("caption settings") ||
    t.includes("font size") ||
    t.includes("font color") ||
    t.includes("format_size") ||
    t.includes("arrow_downward") ||
    t.includes("jump to bottom") ||
    t.includes("jump to the bottom") ||
    t.includes("jump to most recent captions")
  ) {
    return true;
  }
  if (
    t.includes("your mic is off") ||
    t.includes("mic is off") ||
    t.includes("microphone is off") ||
    t.includes("mic is muted") ||
    t.includes("microphone is muted") ||
    t.includes("you're muted") ||
    t.includes("you are muted") ||
    t.includes("turn on microphone") ||
    t.includes("turn on mic") ||
    t.includes("unmute") ||
    t.includes("camera is off") ||
    t.includes("your camera is off") ||
    t.includes("turn on camera")
  ) {
    return true;
  }
  return false;
}

function scoreCaptionContainer(el) {
  if (!el) return 0;
  let score = 0;
  const blockCount = el.querySelectorAll
    ? el.querySelectorAll("div.nMcdL.bj4p3b").length
    : 0;
  if (blockCount) score += 120 + Math.min(blockCount, 6) * 10;
  if (el.querySelector("[data-participant-id]")) score += 30;
  const label = (el.getAttribute("aria-label") || "").toLowerCase();
  if (label.includes("captions")) score += 60;
  if (el.getAttribute("jscontroller") === "KPn5nb") score += 60;
  if (el.classList?.contains("vNKgIf")) score += 20;
  if (el.classList?.contains("UDinHf")) score += 20;

  const text = (el.innerText || "").trim();
  const lines = text.split("\n").filter(Boolean);
  score += Math.min(lines.length, 20);
  score += Math.min(Math.floor(text.length / 200), 10);
  return score;
}

function isCaptionContainer(el) {
  if (!el) return false;
  if (el.querySelector("div.nMcdL.bj4p3b")) return true;
  if (el.getAttribute("data-captions-display") !== null) return true;
  if ((el.getAttribute("role") || "").toLowerCase() === "log") return true;
  const label = (el.getAttribute("aria-label") || "").toLowerCase();
  if (label.includes("caption") || label.includes("subtitle")) return true;
  return false;
}

function pickBestCaptionContainer() {
  const candidates = getCaptionContainers();
  if (!candidates.length) return null;
  const withBlocks = candidates.filter((c) =>
    c.querySelector ? c.querySelector("div.nMcdL.bj4p3b") : false,
  );
  if (withBlocks.length) {
    return withBlocks.sort((a, b) => {
      const aCount = a.querySelectorAll
        ? a.querySelectorAll("div.nMcdL.bj4p3b").length
        : 0;
      const bCount = b.querySelectorAll
        ? b.querySelectorAll("div.nMcdL.bj4p3b").length
        : 0;
      return bCount - aCount;
    })[0];
  }
  return candidates.sort(
    (a, b) => scoreCaptionContainer(b) - scoreCaptionContainer(a),
  )[0];
}

function getBlocksFromContainer(container) {
  if (!container) return [];
  if (isInsideExtensionUI(container)) return [];

  const known = Array.from(
    container.querySelectorAll
      ? container.querySelectorAll("div.nMcdL.bj4p3b")
      : [],
  );
  if (known.length)
    return known.filter(
      (el) =>
        !isInsideExtensionUI(el) && el.innerText && el.innerText.length > 0,
    );

  const knownDeep = queryAllDeep("div.nMcdL.bj4p3b", container).filter(
    (el) => !isInsideExtensionUI(el),
  );
  if (knownDeep.length)
    return knownDeep.filter((el) => el.innerText && el.innerText.length > 0);

  const children = Array.from(container.children).filter(
    (el) =>
      !isInsideExtensionUI(el) &&
      el.innerText &&
      el.innerText.trim().length > 0,
  );
  if (children.length) return children;

  const nodes = Array.from(container.querySelectorAll("div, span")).filter(
    (el) =>
      !isInsideExtensionUI(el) &&
      el.innerText &&
      el.innerText.trim().length > 0,
  );
  if (nodes.length) return nodes.slice(0, 50);

  if (container.innerText && container.innerText.trim().length > 0) {
    return [container];
  }

  return [];
}

function getCaptionBlocks() {
  let container =
    window._captionContainer && document.contains(window._captionContainer)
      ? window._captionContainer
      : pickBestCaptionContainer();

  if (container) {
    window._captionContainer = container;
    const blocks = getBlocksFromContainer(container);
    if (blocks.length) return blocks;
  }

  const fallback = Array.from(document.querySelectorAll("div.nMcdL.bj4p3b"));
  if (fallback.length) {
    return fallback.filter(
      (el) =>
        !isInsideExtensionUI(el) && el.innerText && el.innerText.length > 0,
    );
  }

  const deepFallback = queryAllDeep("div.nMcdL.bj4p3b").filter(
    (el) => !isInsideExtensionUI(el),
  );
  return deepFallback.filter((el) => el.innerText && el.innerText.length > 0);
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

  if (speakerEl && textEl) {
    const speaker = speakerEl.innerText.trim();
    const text = textEl.innerText.trim();
    if (speaker && text) return { speaker, text };
  }


  // filter trường hợp bị đảo ngược (rất quan trọng)
  const raw = (block.innerText || "").trim();
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const speaker = lines[0];
    const text = lines.slice(1).join(" ").trim();
    if (speaker && text) return { speaker, text };
  }

  const colonIndex = raw.indexOf(":");
  if (colonIndex > 0) {
    const speaker = raw.slice(0, colonIndex).trim();
    const text = raw.slice(colonIndex + 1).trim();
    if (speaker && text) return { speaker, text };
  }

  return { speaker: "Speaker", text: raw };
}

function extractFromCaptionBlock(block) {
  if (!block) return null;

  let speakerEl =
    block.querySelector('[class*="NWp"]') ||
    block.querySelector("[data-participant-id]") ||
    block.querySelector("span");

  let textEl =
    block.querySelector('[class*="ygicle"]') ||
    block.querySelector("div:last-child");

  if (speakerEl && textEl) {
    const speaker = speakerEl.innerText.trim();
    const text = textEl.innerText.trim();
    if (speaker && text) return { speaker, text };
  }

  const childTexts = Array.from(block.children)
    .map((el) => (el?.innerText || "").trim())
    .filter(Boolean);
  if (childTexts.length >= 2) {
    const speaker = childTexts[0];
    const text = childTexts.slice(1).join(" ").trim();
    if (speaker && text) return { speaker, text };
  }

  const raw = (block.innerText || "").trim();
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const speaker = lines[0];
    const text = lines.slice(1).join(" ").trim();
    if (speaker && text) return { speaker, text };
  }

  const colonIndex = raw.indexOf(":");
  if (colonIndex > 0) {
    const speaker = raw.slice(0, colonIndex).trim();
    const text = raw.slice(colonIndex + 1).trim();
    if (speaker && text) return { speaker, text };
  }

  return { speaker: "Speaker", text: raw };
}

function handleCaptions() {
  const blocks = getCaptionBlocks();
  if (blocks.length > 0) {
    lastCaptionSeenAt = Date.now();
  }

  if (blocks.length > 0 && !captionDetectedNotified) {
    captionDetectedNotified = true;
    safeSendMessage({
      type: "CAPTION_STATUS",
      payload: {
        state: "detected",
        reason: "caption_blocks_found",
      },
    });
  }

  blocks.forEach((block) => {
    const result = extractFromCaptionBlock(block);
    if (!result) return;

    const { speaker, text } = result;

    const fullMessage = cleanMessage(text);

    // tránh spam giống nhau
    if (currentSpeech[speaker] === fullMessage) return;

    currentSpeech[speaker] = fullMessage;
    // Send incremental updates immediately to avoid waiting on long caption streams.
    finalizeSentence(speaker, fullMessage);

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





function handleLiveRegions() {
  const regions = queryAllDeep(
    '[aria-live="polite"], [aria-live="assertive"]',
  );
  if (!regions.length) return;

  regions.forEach((region) => {
    if (isInsideExtensionUI(region)) return;
    if (!isCaptionContainer(region)) return;
    const raw = (region.innerText || "").trim();
    if (!raw) return;

    const cleaned = cleanMessage(raw);
    if (cleaned.length < 2) return;
    if (isSystemCaptionText("Speaker", cleaned)) return;

    const prev = liveRegionCache.get(region) || "";
    if (prev === cleaned) return;
    liveRegionCache.set(region, cleaned);
    lastLiveRegionSeenAt = Date.now();

    if (!captionDetectedNotified) {
      captionDetectedNotified = true;
      safeSendMessage({
        type: "CAPTION_STATUS",
        payload: {
          state: "detected",
          reason: "aria_live_text",
        },
      });
    }

    finalizeSentence("Speaker", cleaned);
  });
}

// Override: debounce finalize to avoid splitting one sentence into many requests.
function handleCaptions() {
  const blocks = getCaptionBlocks();

  if (blocks.length > 0 && !captionDetectedNotified) {
    captionDetectedNotified = true;
    safeSendMessage({
      type: "CAPTION_STATUS",
      payload: {
        state: "detected",
        reason: "caption_blocks_found",
      },
    });
  }

  blocks.forEach((block) => {
    const result = extractFromCaptionBlock(block);
    if (!result) return;

    const { speaker, text } = result;
    const fullMessage = cleanMessage(text);

    if (currentSpeech[speaker] === fullMessage) return;

    currentSpeech[speaker] = fullMessage;
    sendUpdateLive();

    if (speakerTimers[speaker]) clearTimeout(speakerTimers[speaker]);

    const capturedText = fullMessage;
    speakerTimers[speaker] = setTimeout(() => {
      if (currentSpeech[speaker] === capturedText) {
        finalizeSentence(speaker, capturedText);
        delete currentSpeech[speaker];
        sendUpdateLive();
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
  window._captionContainer = container;

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

  if (!captionDetectedNotified && isCaptionContainer(container)) {
    captionDetectedNotified = true;
    safeSendMessage({
      type: "CAPTION_STATUS",
      payload: {
        state: "detected",
        reason: "caption_container_found",
      },
    });
  }

  // Initial scan in case captions are already visible
  try {
    handleCaptions();
  } catch (err) {
    console.warn("Initial caption scan failed:", err);
  }
}

function waitForCaptionContainer() {
  const existing = window._captionContainer;
  if (existing && document.contains(existing)) {
    const hasBlocks = existing.querySelector
      ? existing.querySelector("div.nMcdL.bj4p3b")
      : null;
    const hasLiveText =
      existing.getAttribute &&
      (existing.getAttribute("aria-live") === "polite" ||
        existing.getAttribute("aria-live") === "assertive");
    if (hasBlocks || hasLiveText) {
      return true;
    }
  }

  const container = pickBestCaptionContainer();
  if (container) {
    initObserver(container);
    return true;
  }

  return false;
}

let ensureScheduled = false;
function scheduleEnsureObserver() {
  if (ensureScheduled) return;
  ensureScheduled = true;
  requestAnimationFrame(() => {
    ensureScheduled = false;
    waitForCaptionContainer();
  });

  const quickBlocks = document.querySelectorAll("div.nMcdL.bj4p3b");
  if (!quickBlocks.length) {
    const deepBlocks = queryAllDeep("div.nMcdL.bj4p3b");
    if (!deepBlocks.length) handleLiveRegions();
  }
}

const bodyObserver = new MutationObserver(() => {
  scheduleEnsureObserver();
});

try {
  bodyObserver.observe(document.body, { childList: true, subtree: true });
} catch {}

const finder = setInterval(() => {
  if (waitForCaptionContainer()) clearInterval(finder);
}, 300);

console.log("Waiting for caption container...");

let captionNotFoundNotified = false;
let captionFinderTries = 0;
const CAPTION_FINDER_MAX_TRIES = 30;

const captionFinder = setInterval(() => {
  captionFinderTries += 1;
  if (waitForCaptionContainer()) {
    clearInterval(captionFinder);
    return;
  }

  if (!captionNotFoundNotified && captionFinderTries >= CAPTION_FINDER_MAX_TRIES) {
    captionNotFoundNotified = true;
    safeSendMessage({
      type: "CAPTION_STATUS",
      payload: {
        state: "not_found",
        reason: "caption_container_not_found",
      },
    });
    reportContentError({
      event: "caption_container_not_found",
      message: "Caption container not found",
    });
  }
}, 300);

// Fallback: poll live regions even when container is not detected.
setInterval(() => {
  if (sessionExpired) return;
  if (!window._captionContainer || !document.contains(window._captionContainer)) {
    handleLiveRegions();
  }
}, 600);

// Watchdog: if captions go silent, attempt to re-bind and scan again.
const RESYNC_INTERVAL_MS = 4000;
const RESYNC_STALE_MS = 8000;
setInterval(() => {
  if (sessionExpired) return;
  const lastSeen = Math.max(lastCaptionSeenAt, lastLiveRegionSeenAt);
  const stale = !lastSeen || Date.now() - lastSeen > RESYNC_STALE_MS;
  if (!stale) return;
  try {
    if (window._captionObserver) {
      try {
        window._captionObserver.disconnect();
      } catch {}
    }
    window._captionObserver = null;
    window._captionContainer = null;
    captionDetectedNotified = false;
    waitForCaptionContainer();
    handleCaptions();
    handleLiveRegions();
  } catch {}
}, RESYNC_INTERVAL_MS);

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
      safeSendMessage({
        type: "CAPTION_STATUS",
        payload: {
          state: "not_found",
          reason: "caption_container_not_found",
        },
      });
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
          safeSendMessage({
            type: "CAPTION_STATUS",
            payload: {
              state: "empty",
              reason: "caption_blocks_empty",
            },
          });
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
