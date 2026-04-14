//content.js
console.log("🔍 Google Meet Caption Logger — Started v4.0.0");

let currentSpeech = {};
let speakerTimers = {};
let meeting_log = [];
let lastFinalized = {};
const SPEAKER_TIMEOUT = 2000;
let lastFinalizedText = {};
let captionDetectedNotified = false;
let deepContainersCache = [];
let lastDeepScanAt = 0;
let liveRegionCache = new WeakMap();
let lastCaptionSeenAt = 0;
let lastLiveRegionSeenAt = 0;
let recentFinalizedCache = new Map();
let rafScheduled = false;
let captionNotFoundNotified = false;
let captionFinderTries = 0;
const CAPTION_FINDER_MAX_TRIES = 30;
const RESYNC_INTERVAL_MS = 4000;
const RESYNC_STALE_MS = 8000;
let lastLivePayload = "";
let liveUpdateTimer = null;

// Legacy class selectors — kept as ONE of many strategies.
// Google obfuscates these and changes them frequently.
const LEGACY_BLOCK_SELECTOR =
  'div.nMcdL.bj4p3b, div.UVSzeb, div[class*="UVSzeb"], div.ygicle, div[class*="ygicle"], div[data-participant-id]';

// Stable selectors based on ARIA attributes (language-agnostic where possible)
const CAPTION_ARIA_KEYWORDS = [
  "caption", "captions", "subtitle", "subtitles",
  "phụ đề", "chú thích", "자막", "字幕", "untertitel",
  "sous-titre", "sottotitoli", "subtítulos",
];

function buildAriaSelector(keywords) {
  const parts = [];
  for (const kw of keywords) {
    parts.push(`[aria-label*="${kw}" i]`);
  }
  return parts.join(", ");
}

const CAPTION_REGION_ARIA_SELECTOR = buildAriaSelector(CAPTION_ARIA_KEYWORDS);

function queryCaptionBlocks(root = document) {
  if (!root?.querySelectorAll) return [];
  try {
    return Array.from(root.querySelectorAll(LEGACY_BLOCK_SELECTOR)).filter(Boolean);
  } catch {
    return [];
  }
}

// ===== UTILITY =====

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
  const payload = JSON.stringify(currentSpeech || {});
  if (payload === lastLivePayload && liveUpdateTimer) return;
  lastLivePayload = payload;
  if (liveUpdateTimer) clearTimeout(liveUpdateTimer);
  liveUpdateTimer = setTimeout(() => {
    liveUpdateTimer = null;
    safeSendMessage({
      type: "LIVE_TRANSCRIPT",
      payload: { action: "update_live", currentSpeech },
    });
  }, 120);
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

function isVisibleElement(el) {
  if (!el) return false;
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  } catch {
    return false;
  }
}

// ===== SHADOW DOM TRAVERSAL =====

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
    try {
      r.querySelectorAll(selector).forEach((el) => results.push(el));
    } catch {}
  });
  return results;
}

// ===== SYSTEM / NOISE TEXT DETECTION =====

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

function isUINoiseText(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  const noisePatterns = [
    "press the down arrow",
    "more options",
    "meeting details",
    "reaction",
    "turn on",
    "you can't",
    "present now",
    "raise hand",
    "leave call",
    "end call",
    "people",
    "chat with everyone",
    "send a message",
    "activities",
  ];
  for (const p of noisePatterns) {
    if (t.includes(p)) return true;
  }
  if (t.length < 2) return true;
  return false;
}

// ===== CC BUTTON DETECTION =====

function findCCButton() {
  // The CC toggle button has labels like:
  //   "Turn on captions (c)" / "Turn off captions (c)"
  //   "Bật phụ đề" / "Tắt phụ đề"
  const allButtons = document.querySelectorAll("button");
  for (const btn of allButtons) {
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    const tooltip = (btn.getAttribute("data-tooltip") || "").toLowerCase();
    const text = label || tooltip;

    // Must mention caption/subtitle keywords
    const hasCaptionKeyword =
      text.includes("caption") || text.includes("subtitle") ||
      text.includes("phụ đề") || text.includes("chú thích");
    if (!hasCaptionKeyword) continue;

    // Must be a toggle (turn on/off), not a settings/menu button
    if (text.includes("setting") || text.includes("menu") ||
        text.includes("open") || text.includes("cài đặt")) continue;

    // Prefer buttons with "turn on/off" pattern
    if (text.includes("turn on") || text.includes("turn off") ||
        text.includes("bật") || text.includes("tắt")) {
      return btn;
    }

    // Accept if it has aria-pressed (toggle button)
    if (btn.hasAttribute("aria-pressed")) return btn;
  }

  // Fallback: any button with caption keyword that looks like a toggle
  const selectors = [
    'button[aria-label*="caption" i]',
    'button[aria-label*="subtitle" i]',
  ];
  for (const sel of selectors) {
    try {
      const buttons = document.querySelectorAll(sel);
      for (const btn of buttons) {
        const label = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes("setting") || label.includes("menu") ||
            label.includes("open")) continue;
        return btn;
      }
    } catch {}
  }
  return null;
}

function isCCEnabled() {
  const btn = findCCButton();
  if (!btn) return null;
  const label = (btn.getAttribute("aria-label") || "").toLowerCase();
  if (label.includes("turn off") || label.includes("tắt")) return true;
  if (label.includes("turn on") || label.includes("bật")) return false;
  const pressed = btn.getAttribute("aria-pressed");
  if (pressed === "true") return true;
  if (pressed === "false") return false;
  return null;
}

// ===== CAPTION CONTAINER DETECTION (RESILIENT) =====

const INTERACTIVE_TAGS = new Set([
  "BUTTON", "A", "INPUT", "SELECT", "TEXTAREA", "LABEL", "OPTION",
]);

function isInteractiveElement(el) {
  if (!el || !el.tagName) return false;
  if (INTERACTIVE_TAGS.has(el.tagName)) return true;
  const role = (el.getAttribute?.("role") || "").toLowerCase();
  if (role === "button" || role === "link" || role === "menuitem" ||
      role === "tab" || role === "switch" || role === "checkbox") return true;
  return false;
}

function hasCaptionAriaLabel(el) {
  if (!el || !el.getAttribute) return false;
  const label = (el.getAttribute("aria-label") || "").toLowerCase();
  if (!CAPTION_ARIA_KEYWORDS.some((kw) => label.includes(kw))) return false;
  // Exclude UI-control labels like "Turn on captions", "Open caption settings"
  if (label.includes("turn on") || label.includes("turn off") ||
      label.includes("open") || label.includes("close") ||
      label.includes("toggle") || label.includes("setting") ||
      label.includes("bật") || label.includes("tắt") ||
      label.includes("mở") || label.includes("đóng")) return false;
  return true;
}

function getCaptionContainers() {
  const containers = new Set();

  // Strategy 1: aria-label containing caption/subtitle keywords (most stable)
  try {
    document.querySelectorAll(CAPTION_REGION_ARIA_SELECTOR).forEach((el) => {
      if (!isInsideExtensionUI(el)) containers.add(el);
    });
  } catch {
    for (const kw of CAPTION_ARIA_KEYWORDS) {
      document.querySelectorAll(`[aria-label]`).forEach((el) => {
        if (isInsideExtensionUI(el)) return;
        const label = (el.getAttribute("aria-label") || "").toLowerCase();
        if (label.includes(kw)) containers.add(el);
      });
    }
  }

  // Strategy 2: aria-live regions (core accessibility feature for captions)
  document
    .querySelectorAll('[aria-live="polite"], [aria-live="assertive"]')
    .forEach((el) => {
      if (!isInsideExtensionUI(el)) containers.add(el);
    });

  // Strategy 3: data-captions-display attribute
  document
    .querySelectorAll("[data-captions-display]")
    .forEach((el) => containers.add(el));

  // Strategy 4: role="log" elements
  document.querySelectorAll('[role="log"]').forEach((el) => containers.add(el));

  // Strategy 5: jscontroller with caption-related aria-label
  document.querySelectorAll("[jscontroller]").forEach((el) => {
    if (isInsideExtensionUI(el)) return;
    if (hasCaptionAriaLabel(el)) containers.add(el);
    const ariaLive = el.getAttribute("aria-live");
    if (ariaLive === "polite" || ariaLive === "assertive") containers.add(el);
  });

  // Strategy 6: Legacy class selectors (may still work on older Meet versions)
  try {
    queryCaptionBlocks(document).forEach((b) => {
      if (isInsideExtensionUI(b)) return;
      const c = b?.parentElement?.parentElement;
      if (c) containers.add(c);
    });
  } catch {}

  // Strategy 7: Look for parent elements of caption-related children
  try {
    document.querySelectorAll("[data-participant-id]").forEach((el) => {
      if (isInsideExtensionUI(el)) return;
      let parent = el.parentElement;
      for (let i = 0; i < 3 && parent; i++) {
        if (
          parent.children.length >= 1 &&
          parent.children.length <= 20 &&
          parent.innerText &&
          parent.innerText.trim().length > 2
        ) {
          containers.add(parent);
          break;
        }
        parent = parent.parentElement;
      }
    });
  } catch {}

  // Strategy 8: Deep shadow DOM scan (throttled)
  const now = Date.now();
  if (now - lastDeepScanAt > 2000) {
    lastDeepScanAt = now;
    try {
      deepContainersCache = queryAllDeep(
        '[aria-live="polite"], [aria-live="assertive"], [data-captions-display], [role="log"]',
      );
    } catch {
      deepContainersCache = [];
    }
  }
  deepContainersCache.forEach((el) => {
    if (!isInsideExtensionUI(el)) containers.add(el);
  });

  // CRITICAL: Filter out interactive elements (buttons, links, inputs).
  // CC toggle buttons match [aria-label*="caption"] but are NOT containers.
  return Array.from(containers).filter(
    (el) => el && !isInteractiveElement(el),
  );
}

function isCaptionContainer(el) {
  if (!el) return false;
  if (isInteractiveElement(el)) return false;

  // Legacy class check
  if (el.querySelector && el.querySelector(LEGACY_BLOCK_SELECTOR)) return true;
  if (el.querySelector?.('[class*="ygicle"], .ygicle, [class*="NWpY1d"], .NWpY1d')) return true;

  // data-captions-display
  if (el.getAttribute && el.getAttribute("data-captions-display") !== null)
    return true;

  // role="log"
  if ((el.getAttribute?.("role") || "").toLowerCase() === "log") return true;

  // Caption-related aria-label
  if (hasCaptionAriaLabel(el)) return true;

  // aria-live region that contains multi-line or structured text
  const ariaLive = el.getAttribute?.("aria-live") || "";
  if (ariaLive === "polite" || ariaLive === "assertive") {
    const text = (el.innerText || "").trim();
    if (text.length > 2 && !isUINoiseText(text)) return true;
  }

  // Check if parent has caption aria-label
  if (el.parentElement && hasCaptionAriaLabel(el.parentElement)) return true;

  // Check for participant-id descendant (strong indicator of caption blocks)
  if (el.querySelector?.("[data-participant-id]")) return true;

  return false;
}

function scoreCaptionContainer(el) {
  if (!el) return 0;
  // Interactive elements should never be containers
  if (isInteractiveElement(el)) return -1000;
  let score = 0;

  // Caption-related aria-label — strongest stable indicator
  if (hasCaptionAriaLabel(el)) score += 100;

  // aria-live regions
  const ariaLive = el.getAttribute?.("aria-live") || "";
  if (ariaLive === "polite") score += 40;
  if (ariaLive === "assertive") score += 35;

  // role="log" or data-captions-display
  const role = (el.getAttribute?.("role") || "").toLowerCase();
  if (role === "log") score += 50;
  if (el.getAttribute?.("data-captions-display") !== null) score += 80;

  // Legacy class check
  const blockCount = el.querySelectorAll
    ? el.querySelectorAll(LEGACY_BLOCK_SELECTOR).length
    : 0;
  if (blockCount) score += 120 + Math.min(blockCount, 6) * 10;

  // participant-id descendant
  if (el.querySelector?.("[data-participant-id]")) score += 30;

  // jscontroller attribute
  if (el.getAttribute?.("jscontroller")) score += 10;

  // Text content scoring
  const text = (el.innerText || "").trim();
  const lines = text.split("\n").filter(Boolean);
  score += Math.min(lines.length, 20);
  score += Math.min(Math.floor(text.length / 200), 10);

  // Position scoring — captions appear at the bottom of the viewport
  try {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (rect.bottom > window.innerHeight * 0.65) score += 15;
      // Penalize elements that span the entire page (likely a root container)
      if (rect.height > window.innerHeight * 0.8) score -= 50;
    }
  } catch {}

  // Penalize if the element is too large (likely not a caption container)
  const childCount = el.children?.length || 0;
  if (childCount > 50) score -= 30;

  return score;
}

function pickBestCaptionContainer() {
  const candidates = getCaptionContainers();
  if (!candidates.length) return null;

  // Priority 1: containers with legacy caption blocks (DIV only)
  const withLegacyBlocks = candidates.filter((c) => {
    if (!c.querySelectorAll) return false;
      return c.querySelectorAll(LEGACY_BLOCK_SELECTOR).length > 0;
  });
  if (withLegacyBlocks.length) {
    return withLegacyBlocks.sort((a, b) => {
      const aCount = a.querySelectorAll(LEGACY_BLOCK_SELECTOR).length;
      const bCount = b.querySelectorAll(LEGACY_BLOCK_SELECTOR).length;
      return bCount - aCount;
    })[0];
  }

  // Priority 2: containers with caption-specific aria-label (e.g. aria-label="Captions")
  const withAriaLabel = candidates.filter(
    (c) => hasCaptionAriaLabel(c) && isVisibleElement(c),
  );
  if (withAriaLabel.length === 1) return withAriaLabel[0];
  if (withAriaLabel.length > 1) {
    return withAriaLabel.sort(
      (a, b) => scoreCaptionContainer(b) - scoreCaptionContainer(a),
    )[0];
  }

  // Priority 3: aria-live containers that have actual text content
  const liveWithText = candidates.filter((c) => {
    const ariaLive = c.getAttribute?.("aria-live") || "";
    if (ariaLive !== "polite" && ariaLive !== "assertive") return false;
    const text = (c.innerText || "").trim();
    return text.length > 2 && !isUINoiseText(text);
  });
  if (liveWithText.length) {
    return liveWithText.sort(
      (a, b) => scoreCaptionContainer(b) - scoreCaptionContainer(a),
    )[0];
  }

  // Priority 4: any remaining candidates sorted by score
  const scored = candidates
    .sort((a, b) => scoreCaptionContainer(b) - scoreCaptionContainer(a));

  return scored[0] || null;
}

// ===== CAPTION BLOCK EXTRACTION =====

function getBlocksFromContainer(container) {
  if (!container) return [];
  if (isInsideExtensionUI(container)) return [];

  // Strategy 1: Legacy class selectors
  try {
    const legacy = Array.from(
      container.querySelectorAll ? container.querySelectorAll(LEGACY_BLOCK_SELECTOR) : [],
    ).filter((el) => !isInsideExtensionUI(el) && el.innerText?.trim());
    if (legacy.length) return legacy;
  } catch {}

  // Strategy 2: Deep search with legacy selectors
  try {
    const deepLegacy = queryAllDeep(LEGACY_BLOCK_SELECTOR, container).filter(
      (el) => !isInsideExtensionUI(el) && el.innerText?.trim(),
    );
    if (deepLegacy.length) return deepLegacy;
  } catch {}

  // Strategy 3: participant-id based blocks
  try {
    const participantBlocks = Array.from(
      container.querySelectorAll("[data-participant-id]"),
    )
      .map((el) => el.closest("div") || el.parentElement)
      .filter(
        (el) =>
          el && !isInsideExtensionUI(el) && el.innerText?.trim().length > 2,
      );
    if (participantBlocks.length) return [...new Set(participantBlocks)];
  } catch {}

  // Strategy 4: Direct children with text (common pattern for new Meet DOM)
  const children = Array.from(container.children).filter((el) => {
    if (isInsideExtensionUI(el)) return false;
    const text = (el.innerText || "").trim();
    if (!text || text.length < 2) return false;
    if (isUINoiseText(text)) return false;
    return true;
  });
  if (children.length && children.length <= 30) return children;

  // Strategy 5: Any meaningful div/span descendants (limited)
  const nodes = Array.from(container.querySelectorAll("div, span"))
    .filter((el) => {
      if (isInsideExtensionUI(el)) return false;
      const text = (el.innerText || "").trim();
      if (!text || text.length < 3) return false;
      if (isUINoiseText(text)) return false;
      // Must be a "leaf-ish" node — not a huge container
      if (el.children.length > 10) return false;
      return true;
    })
    .slice(0, 30);
  if (nodes.length) return nodes;

  // Strategy 6: Container itself has text
  if (container.innerText && container.innerText.trim().length > 2) {
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

  // Fallback: direct legacy selector on entire document
  try {
    const fallback = Array.from(
      queryCaptionBlocks(document),
    );
    if (fallback.length) {
      return fallback.filter(
        (el) => !isInsideExtensionUI(el) && el.innerText?.trim(),
      );
    }
  } catch {}

  // Fallback: deep legacy search
  try {
    const deepFallback = queryAllDeep(LEGACY_BLOCK_SELECTOR).filter(
      (el) => !isInsideExtensionUI(el) && el.innerText?.trim(),
    );
    if (deepFallback.length) return deepFallback;
  } catch {}

  return [];
}

// ===== SPEAKER & TEXT EXTRACTION (Structure-agnostic) =====

function extractFromCaptionBlock(block) {
  if (!block) return null;

  // Strategy 1: Legacy class-based extraction
  try {
    const speakerEl =
      block.querySelector("span.NWpY1d") ||
      block.querySelector('[class*="NWp"]');
    const textEl =
      block.querySelector("div.ygicle.VbkSUe") ||
      block.querySelector('[class*="ygicle"]');
    if (speakerEl && textEl) {
      const speaker = speakerEl.innerText.trim();
      const text = textEl.innerText.trim();
      if (speaker && text) return { speaker, text };
    }
  } catch {}

  // Strategy 2: data-participant-id + adjacent text
  try {
    const pidEl = block.querySelector("[data-participant-id]");
    if (pidEl) {
      const speaker = pidEl.innerText?.trim();
      if (speaker) {
        const fullText = block.innerText.trim();
        const text = fullText.replace(speaker, "").trim();
        if (text) return { speaker, text };
      }
    }
  } catch {}

  // Strategy 3: First span/strong/b child = speaker, rest = text
  try {
    const speakerEl =
      block.querySelector("b") ||
      block.querySelector("strong") ||
      block.querySelector("span:first-child");

    if (speakerEl) {
      const speaker = speakerEl.innerText?.trim();
      if (speaker) {
        const fullText = block.innerText.trim();
        let text = fullText;
        const speakerIdx = text.indexOf(speaker);
        if (speakerIdx >= 0) {
          text = text.slice(speakerIdx + speaker.length).trim();
        }
        text = text.replace(/^[:\-–—]\s*/, "").trim();
        if (text && text !== speaker) return { speaker, text };
      }
    }
  } catch {}

  // Strategy 4: Children-based extraction (first child = speaker, others = text)
  const childTexts = Array.from(block.children)
    .map((el) => (el?.innerText || "").trim())
    .filter(Boolean);
  if (childTexts.length >= 2) {
    const speaker = childTexts[0];
    const text = childTexts.slice(1).join(" ").trim();
    if (speaker && text && speaker !== text) return { speaker, text };
  }

  // Strategy 5: Newline-separated text (Speaker\nCaption text)
  const raw = (block.innerText || "").trim();
  if (!raw) return null;

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const speaker = lines[0];
    const text = lines.slice(1).join(" ").trim();
    if (speaker && text) return { speaker, text };
  }

  // Strategy 6: Colon-separated (Speaker: text)
  const colonIndex = raw.indexOf(":");
  if (colonIndex > 0 && colonIndex < 40) {
    const speaker = raw.slice(0, colonIndex).trim();
    const text = raw.slice(colonIndex + 1).trim();
    if (speaker && text) return { speaker, text };
  }

  // Strategy 7: If we have text but can't identify speaker
  if (raw.length > 2) {
    return { speaker: "Speaker", text: raw };
  }

  return null;
}

// ===== TEXT PROCESSING =====

function removeRepeatedPart(speaker, newText) {
  const oldText = lastFinalized[speaker] || "";
  if (!oldText) return newText;
  if (newText.startsWith(oldText)) return newText.slice(oldText.length).trim();
  const index = newText.indexOf(oldText);
  if (index >= 0) return newText.slice(index + oldText.length).trim();
  return newText;
}

function getDelta(prev, curr) {
  if (!prev) return curr;
  const prevWords = prev.split(/\s+/);
  const currWords = curr.split(/\s+/);
  let i = 0;
  while (
    i < prevWords.length &&
    i < currWords.length &&
    prevWords[i] === currWords[i]
  ) {
    i++;
  }
  return currWords.slice(i).join(" ").trim();
}

function wasRecentlyFinalized(text, ttlMs = 15000) {
  const now = Date.now();
  for (const [key, ts] of recentFinalizedCache.entries()) {
    if (now - ts > ttlMs) recentFinalizedCache.delete(key);
  }
  const key = String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (recentFinalizedCache.has(key)) return true;
  recentFinalizedCache.set(key, now);
  return false;
}

function finalizeSentence(speaker, sentence) {
  if (!sentence) return;
  if (isSystemCaptionText(speaker, sentence)) return;

  const prev = lastFinalizedText[speaker] || "";
  const delta = getDelta(prev, sentence);

  if (!delta || delta.length < 2) return;
  if (wasRecentlyFinalized(delta)) return;

  safeSendMessage({
    type: "LIVE_TRANSCRIPT",
    payload: { action: "finalize", speaker, finalized: delta },
  });

  lastFinalizedText[speaker] = sentence;
}

function finalizeSpeech(speaker) {
  const message = currentSpeech[speaker];
  if (!message) return;

  meeting_log.push(`${speaker}: "${message}"`);
  delete currentSpeech[speaker];
  sendUpdateLive();
}

// ===== ERROR HANDLERS =====

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SESSION_EXPIRED") {
    console.log("SESSION_EXPIRED ignored: live session limits disabled.");
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

// ===== CORE CAPTION HANDLER (single definition) =====

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

    if (!fullMessage || fullMessage.length < 2) return;
    if (isSystemCaptionText(speaker, fullMessage)) return;
    if (isUINoiseText(fullMessage)) return;
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

// ===== LIVE REGION HANDLER =====

function handleLiveRegions() {
  if (Date.now() - lastCaptionSeenAt < 1800) return;

  let regions;
  try {
    regions = queryAllDeep(
      '[aria-live="polite"], [aria-live="assertive"]',
    );
  } catch {
    regions = Array.from(
      document.querySelectorAll(
        '[aria-live="polite"], [aria-live="assertive"]',
      ),
    );
  }
  if (!regions.length) return;

  regions.forEach((region) => {
    if (isInsideExtensionUI(region)) return;

    const raw = (region.innerText || "").trim();
    if (!raw || raw.length < 2) return;

    const cleaned = cleanMessage(raw);
    if (cleaned.length < 2) return;
    if (isSystemCaptionText("Speaker", cleaned)) return;
    if (isUINoiseText(cleaned)) return;

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

    // Try to parse speaker + text from the region content
    const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const speaker = lines[0];
      const text = lines.slice(1).join(" ").trim();
      if (speaker && text && !isSystemCaptionText(speaker, text)) {
        finalizeSentence(speaker, text);
        return;
      }
    }

    finalizeSentence("Speaker", cleaned);
  });
}

// ===== OBSERVER SETUP =====

function initObserver(container) {
  if (window._captionObserver) {
    try {
      window._captionObserver.disconnect();
    } catch {}
  }
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

  try {
    handleCaptions();
  } catch (err) {
    console.warn("Initial caption scan failed:", err);
  }
}

function waitForCaptionContainer() {
  const existing = window._captionContainer;
  if (existing && document.contains(existing) && !isInteractiveElement(existing)) {
    const hasLegacyBlocks = existing.querySelector
      ? existing.querySelector(LEGACY_BLOCK_SELECTOR)
      : null;
    const hasLiveText =
      existing.getAttribute &&
      (existing.getAttribute("aria-live") === "polite" ||
        existing.getAttribute("aria-live") === "assertive");
    const hasCaptionLabel = hasCaptionAriaLabel(existing);
    const hasText = (existing.innerText || "").trim().length > 2;
    if (hasLegacyBlocks || hasLiveText || hasCaptionLabel || hasText) {
      return true;
    }
  }

  const container = pickBestCaptionContainer();
  if (container) {
    // Don't re-init observer on the same element
    if (container === window._captionContainer && window._captionObserver) {
      return true;
    }
    console.log(
      "[CC] Caption container found:",
      container.tagName,
      container.className?.slice(0, 60),
      "\n  aria-label:", container.getAttribute?.("aria-label") || "(none)",
      "\n  aria-live:", container.getAttribute?.("aria-live") || "(none)",
      "\n  text preview:", (container.innerText || "").slice(0, 100),
    );
    initObserver(container);
    return true;
  }

  return false;
}

// ===== CC BUTTON MONITORING =====

let _ccButtonObserver = null;
let _lastCCState = null;

function startCCButtonMonitoring() {
  const btn = findCCButton();
  if (!btn) return;

  if (_ccButtonObserver) {
    try {
      _ccButtonObserver.disconnect();
    } catch {}
  }

  const checkState = () => {
    const enabled = isCCEnabled();
    if (enabled !== _lastCCState) {
      _lastCCState = enabled;
      console.log("[CC] CC button state changed:", enabled ? "ON" : "OFF");
      if (enabled) {
        captionDetectedNotified = false;
        window._captionContainer = null;
        setTimeout(() => {
          waitForCaptionContainer();
          handleCaptions();
          handleLiveRegions();
        }, 500);
      }
    }
  };

  _ccButtonObserver = new MutationObserver(checkState);
  _ccButtonObserver.observe(btn, {
    attributes: true,
    attributeFilter: ["aria-label", "aria-pressed", "data-tooltip"],
  });
  checkState();
}

// ===== SCHEDULING & INITIALIZATION =====

let ensureScheduled = false;
function scheduleEnsureObserver() {
  if (ensureScheduled) return;
  ensureScheduled = true;
  requestAnimationFrame(() => {
    ensureScheduled = false;
    waitForCaptionContainer();
  });

  try {
    const quickBlocks = queryCaptionBlocks(document);
    if (!quickBlocks.length) {
      const deepBlocks = queryAllDeep(LEGACY_BLOCK_SELECTOR);
      if (!deepBlocks.length) handleLiveRegions();
    }
  } catch {
    handleLiveRegions();
  }
}

const bodyObserver = new MutationObserver(() => {
  scheduleEnsureObserver();
});

try {
  bodyObserver.observe(document.body, { childList: true, subtree: true });
} catch {}

// Primary finder interval
const finder = setInterval(() => {
  if (waitForCaptionContainer()) clearInterval(finder);
}, 300);

console.log("Waiting for caption container...");

// Extended finder with status reporting
const captionFinder = setInterval(() => {
  captionFinderTries += 1;

  // Also try to start CC button monitoring periodically
  if (captionFinderTries % 5 === 0) {
    startCCButtonMonitoring();
  }

  if (waitForCaptionContainer()) {
    clearInterval(captionFinder);
    return;
  }

  if (
    !captionNotFoundNotified &&
    captionFinderTries >= CAPTION_FINDER_MAX_TRIES
  ) {
    captionNotFoundNotified = true;

    const ccEnabled = isCCEnabled();
    const reason =
      ccEnabled === false
        ? "cc_button_off"
        : "caption_container_not_found";

    safeSendMessage({
      type: "CAPTION_STATUS",
      payload: {
        state: "not_found",
        reason,
        ccButtonDetected: ccEnabled !== null,
        ccEnabled,
      },
    });
    reportContentError({
      event: "caption_container_not_found",
      message: `Caption container not found (CC enabled: ${ccEnabled})`,
    });
  }
}, 300);

// Fallback: poll live regions even when container is not detected
setInterval(() => {
  if (
    !window._captionContainer ||
    !document.contains(window._captionContainer)
  ) {
    handleLiveRegions();
  }
}, 600);

// Watchdog: if captions go silent, attempt to re-bind and scan again
setInterval(() => {
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
    startCCButtonMonitoring();
  } catch {}
}, RESYNC_INTERVAL_MS);

// Start CC button monitoring after a short delay
setTimeout(() => {
  startCCButtonMonitoring();
}, 2000);

// ===== MESSAGE HANDLERS =====

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "REFRESH_CAPTION_DOM") return;

  const ts = new Date().toISOString();
  const logPrefix = `[REFRESH_CAPTION_DOM ${ts}]`;

  try {
    console.groupCollapsed(`${logPrefix} start`);
    console.log("url:", location.href);

    // 1) Check legacy blocks
    const legacyBlocks = queryCaptionBlocks(document);
    console.log("legacyBlocks.length:", legacyBlocks?.length || 0);

    // 2) Check aria-based containers
    let ariaContainers = [];
    try {
      ariaContainers = Array.from(
        document.querySelectorAll(CAPTION_REGION_ARIA_SELECTOR),
      );
    } catch {}
    console.log("ariaContainers.length:", ariaContainers.length);

    // 3) Check aria-live regions
    const liveRegions = document.querySelectorAll(
      '[aria-live="polite"], [aria-live="assertive"]',
    );
    console.log("liveRegions.length:", liveRegions.length);

    // 4) CC button state
    const ccEnabled = isCCEnabled();
    console.log("CC enabled:", ccEnabled);

    // 5) Find best container
    const container = pickBestCaptionContainer();
    console.log("container found:", Boolean(container));
    if (container) {
      console.log("container tag:", container.tagName);
      console.log("container class:", container.className?.slice(0, 80));
      console.log(
        "container aria-label:",
        container.getAttribute?.("aria-label") || "(none)",
      );
      console.log(
        "container aria-live:",
        container.getAttribute?.("aria-live") || "(none)",
      );
      console.log(
        "container text preview:",
        (container.innerText || "").slice(0, 200),
      );
    }

    if (!container) {
      console.error("Caption container not found.");
      console.groupEnd();
      safeSendMessage({
        type: "CAPTION_STATUS",
        payload: {
          state: "not_found",
          reason: "caption_container_not_found",
        },
      });
      sendResponse({
        ok: false,
        error: "Caption container not found",
        ccEnabled,
      });
      return;
    }

    // 6) Init observer
    initObserver(container);

    // 7) Verify after 500ms
    setTimeout(() => {
      try {
        const blocks = getCaptionBlocks();
        console.log("verify blocks.length:", blocks.length);

        if (blocks.length === 0) {
          console.warn(
            "No blocks found after refresh. CC may be off or DOM structure unknown.",
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

        // Test extraction on first block
        const testResult = extractFromCaptionBlock(blocks[0]);
        console.log("first block extraction:", testResult);

        console.log("Refresh OK ✅");
        console.groupEnd();
        sendResponse({
          ok: true,
          count: blocks.length,
          firstBlock: testResult,
          ccEnabled,
        });
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

  return true;
});

// ===== DIAGNOSTICS =====

function _meetDomDiagnostics() {
  const legacyBlocks = queryCaptionBlocks(document);
  let ariaContainers = [];
  try {
    ariaContainers = Array.from(
      document.querySelectorAll(CAPTION_REGION_ARIA_SELECTOR),
    );
  } catch {}
  const liveRegions = document.querySelectorAll(
    '[aria-live="polite"], [aria-live="assertive"]',
  );
  const container = pickBestCaptionContainer();
  const ccEnabled = isCCEnabled();

  return {
    url: location.href,
    ts: Date.now(),
    legacyBlocksCount: legacyBlocks.length,
    ariaContainersCount: ariaContainers.length,
    liveRegionsCount: liveRegions.length,
    containerFound: Boolean(container),
    containerTag: container ? container.tagName : null,
    containerClass: container ? container.className?.slice(0, 80) : null,
    containerAriaLabel: container
      ? container.getAttribute?.("aria-label") || null
      : null,
    containerAriaLive: container
      ? container.getAttribute?.("aria-live") || null
      : null,
    observerExists: Boolean(window._captionObserver),
    ccButtonDetected: ccEnabled !== null,
    ccEnabled,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "REFRESH_CAPTION_OBSERVER") return;

  try {
    const diagBefore = _meetDomDiagnostics();

    // Reset and re-detect
    if (window._captionObserver) {
      try {
        window._captionObserver.disconnect();
      } catch {}
    }
    window._captionObserver = null;
    window._captionContainer = null;
    captionDetectedNotified = false;

    const container = pickBestCaptionContainer();

    if (!container) {
      const diagFail = _meetDomDiagnostics();
      sendResponse({
        ok: false,
        reason: "Caption container not found after reset",
        diagnostics: { before: diagBefore, after: diagFail },
      });
      return true;
    }

    initObserver(container);

    try {
      handleCaptions();
      handleLiveRegions();
    } catch (e2) {
      const diagAfter = _meetDomDiagnostics();
      sendResponse({
        ok: false,
        reason: `handleCaptions threw error: ${String(e2)}`,
        diagnostics: { before: diagBefore, after: diagAfter },
      });
      return true;
    }

    const diagAfter = _meetDomDiagnostics();
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
