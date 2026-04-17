let latestCaptions = [];
let sharedCaptions = [];
let startTime = null;
let timerInterval = null;
const urlConnect = `https://accounts.google.com/o/oauth2/auth?client_id=242934590241-su4r9eepcub5q56c5cupee44lbsfal51.apps.googleusercontent.com&response_type=token&redirect_uri=https://${chrome.runtime.id}.chromiumapp.org/&scope=https://www.googleapis.com/auth/calendar`;
const URL_BACKEND_PROD = "https://api-as.reelsightsai.com";
const URL_BACKEND_BETA = "https://beta.as.reelsightsai.com";
const URL_BACKEND_LOCAL = "http://localhost:8000";
const URL_BACKEND_REMOBAY = "https://api.reelsights.com";
const URL_HISTORY_PROD = "https://api.reelsightsai.com";
const URL_HISTORY_BETA = "https://beta.hav.reelsightsai.com";
const URL_HISTORY_LOCAL = "http://localhost:8080";
const WEBSITE_URL = "https://reelsightsai.com/";
const WEBSITE_DASHBOARD_URL = "https://reelsightsai.com/dashboard";
const ACCOUNT_SESSION_STORAGE_KEY = "rsai_account_session_v1";
// Change this to: "prod" | "beta" | "local"
const ACTIVE_BACKEND = "beta";
const VITE_URL_BACKEND =
  ACTIVE_BACKEND === "prod"
    ? URL_BACKEND_PROD
    : ACTIVE_BACKEND === "local"
    ? URL_BACKEND_LOCAL
    : URL_BACKEND_BETA;
const VITE_URL_HISTORY =
  ACTIVE_BACKEND === "prod"
    ? URL_HISTORY_PROD
    : ACTIVE_BACKEND === "local"
    ? URL_HISTORY_LOCAL
    : URL_HISTORY_BETA;
const HISTORY_API_CANDIDATES = [
  ...new Set([
    VITE_URL_HISTORY,
    URL_HISTORY_BETA,
    URL_HISTORY_PROD,
  ]),
];
const LOGIN_API_CANDIDATES = [...new Set([URL_BACKEND_PROD, VITE_URL_BACKEND])];
const ACCOUNT_INFO_API_CANDIDATES = [
  ...new Set([URL_BACKEND_PROD, VITE_URL_BACKEND, URL_BACKEND_REMOBAY]),
];
const TELEMETRY_ENDPOINT = "/api/telemetry/extension-error";
const EXTENSION_VERSION = chrome.runtime.getManifest().version;
const ERROR_DEDUP_TTL_MS = 5 * 60 * 1000;
const ERROR_DEDUP_MAX = 200;
const errorDedup = new Map();
const CAPTION_SOURCE_STALE_MS = 12000;
const captionSourceByTab = new Map();
const RECENT_CAPTION_EVENT_TTL_MS = 6000;
const recentCaptionEventsByTab = new Map();
const AI_DIALOGUE_AGENT_ENDPOINTS = {
  gemini: "/api/content-generators/ai_dialogue_architect_agent_gemini",
  groq: "/api/content-generators/ai_dialogue_architect_agent_groq",
  kimi: "/api/content-generators/ai_dialogue_architect_agent_kimi",
};

function getAiDialogueAgentEndpoint(modelKey) {
  return (
    AI_DIALOGUE_AGENT_ENDPOINTS[modelKey] ||
    AI_DIALOGUE_AGENT_ENDPOINTS.gemini
  );
}

function getChromeStorageLocal() {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return chrome.storage.local;
    }
  } catch (error) {
    console.warn("chrome.storage.local unavailable:", error);
  }

  return null;
}

async function loadStoredAccountSession() {
  const storage = getChromeStorageLocal();
  if (!storage) {
    return null;
  }

  const stored = await storage.get(ACCOUNT_SESSION_STORAGE_KEY);
  return stored?.[ACCOUNT_SESSION_STORAGE_KEY] || null;
}

async function saveStoredAccountSession(session) {
  const storage = getChromeStorageLocal();
  if (!storage) {
    throw new Error("Extension storage is unavailable.");
  }

  await storage.set({ [ACCOUNT_SESSION_STORAGE_KEY]: session });
}

async function clearStoredAccountSession() {
  const storage = getChromeStorageLocal();
  if (!storage) {
    return;
  }

  await storage.remove(ACCOUNT_SESSION_STORAGE_KEY);
}

function readCookie(url, name) {
  return new Promise((resolve) => {
    chrome.cookies.get({ url, name }, (cookie) => {
      resolve(cookie?.value || "");
    });
  });
}

function writeCookie(url, name, value, expirationDate) {
  return new Promise((resolve, reject) => {
    chrome.cookies.set(
      {
        url,
        name,
        value: String(value || ""),
        path: "/",
        expirationDate,
      },
      (cookie) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(cookie);
      }
    );
  });
}

function removeCookie(url, name) {
  return new Promise((resolve) => {
    chrome.cookies.remove({ url, name }, () => resolve());
  });
}

function normalizeDisplayName(value) {
  return String(value || "")
    .trim()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeAccountSession(session) {
  const normalized = {
    loggedIn: Boolean(session?.loggedIn),
    username: String(session?.username || "").trim(),
    jwtToken: String(session?.jwtToken || "").trim(),
    loginType: String(session?.loginType || "account").trim() || "account",
    name: String(session?.name || "").trim(),
    creditName: String(session?.creditName || "").trim(),
    source: String(session?.source || "").trim() || "extension",
    expiresAt: Number(session?.expiresAt || 0) || null,
  };

  normalized.loggedIn = Boolean(normalized.username && normalized.jwtToken);
  return normalized;
}

function isAccountSessionExpired(session) {
  const expiresAt = Number(session?.expiresAt || 0);
  return Boolean(expiresAt && Date.now() >= expiresAt);
}

async function readWebsiteAuthState() {
  const [username, jwtToken, loginType, name, creditName] = await Promise.all([
    readCookie(WEBSITE_DASHBOARD_URL, "username"),
    readCookie(WEBSITE_DASHBOARD_URL, "jwt_token"),
    readCookie(WEBSITE_DASHBOARD_URL, "loginType"),
    readCookie(WEBSITE_DASHBOARD_URL, "name"),
    readCookie(WEBSITE_DASHBOARD_URL, "creditName"),
  ]);

  return {
    loggedIn: Boolean(username && jwtToken),
    username,
    jwtToken,
    loginType,
    name,
    creditName,
    source: "website_cookie",
    expiresAt: null,
  };
}

async function clearWebsiteSessionCookies() {
  await Promise.all(
    ["jwt_token", "loginType", "username", "name", "creditName"].map((name) =>
      removeCookie(WEBSITE_URL, name)
    )
  );
}

async function writeWebsiteSessionCookies({
  jwtToken,
  username,
  loginType = "account",
  name = "",
  creditName = "",
  expiresInSeconds = 30 * 24 * 60 * 60,
}) {
  const expirationDate = Math.floor(Date.now() / 1000) + Number(expiresInSeconds || 0);

  await Promise.all([
    writeCookie(WEBSITE_URL, "jwt_token", jwtToken, expirationDate),
    writeCookie(WEBSITE_URL, "loginType", loginType, expirationDate),
    writeCookie(WEBSITE_URL, "username", username, expirationDate),
    writeCookie(WEBSITE_URL, "name", name, expirationDate),
    writeCookie(WEBSITE_URL, "creditName", creditName, expirationDate),
  ]);
}

async function mirrorWebsiteSessionCookies(session, expiresInSeconds) {
  try {
    await writeWebsiteSessionCookies({
      jwtToken: session?.jwtToken,
      username: session?.username,
      loginType: session?.loginType,
      name: session?.name,
      creditName: session?.creditName,
      expiresInSeconds,
    });
  } catch (error) {
    console.warn("writeWebsiteSessionCookies failed:", error);
  }
}

async function readAccountAuthState() {
  const storedSession = normalizeAccountSession(await loadStoredAccountSession());
  if (storedSession.loggedIn) {
    if (!isAccountSessionExpired(storedSession)) {
      return storedSession;
    }

    await clearStoredAccountSession();
  }

  const websiteSession = normalizeAccountSession(await readWebsiteAuthState());
  if (websiteSession.loggedIn) {
    await saveStoredAccountSession(websiteSession);
    return websiteSession;
  }

  return {
    loggedIn: false,
    username: "",
    jwtToken: "",
    loginType: "",
    name: "",
    creditName: "",
    source: "",
    expiresAt: null,
  };
}

async function postJson(baseUrl, path, payload, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error(
      `[${baseUrl}${path}] ${error?.message || String(error)}`
    );
  }

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }

  return { response, data };
}

async function fetchHistoryWithFallback(path, options) {
  let lastResult = null;

  for (const baseUrl of HISTORY_API_CANDIDATES) {
    let timeoutId = null;
    try {
      const url = `${baseUrl}${path}`;
      const timeoutMs = 12000; // keep background responses snappy to avoid port-close

      const controller = new AbortController();
      const externalSignal = options?.signal;
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      timeoutId = setTimeout(() => {
        try {
          controller.abort(
            new Error(`History API request timeout after ${timeoutMs}ms`)
          );
        } catch {
          controller.abort();
        }
      }, timeoutMs);

      const response = await fetch(url, {
        ...(options || {}),
        signal: controller.signal,
      });

      const raw = await response.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }

      if (response.ok) {
        return { ok: true, status: response.status, data, baseUrl };
      }

      // Enrich error so the UI can show a useful message instead of a generic fallback.
      // Common shapes we might receive: { message }, { detail }, { error }, or plain text.
      const messageFromData =
        (data &&
          typeof data === "object" &&
          (data?.message || data?.detail || data?.error)) ||
        (typeof data === "string" ? data : "");

      lastResult = {
        ok: false,
        status: response.status,
        data,
        baseUrl,
        error:
          String(messageFromData || "").trim() ||
          `History API request failed (HTTP ${response.status})`,
      };

      // If one host denies access (401/403), other hosts may still allow.
      // We only hard-stop on "other" statuses where trying another host
      // is unlikely to help.
      if (response.status === 404) continue;
      if (response.status === 401 || response.status === 403) continue;
      return lastResult;
    } catch (error) {
      // If the request is aborted/timeout, treat it as a recoverable error and try next baseUrl.
      lastResult = {
        ok: false,
        status: 0,
        error: String(error),
        baseUrl,
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return lastResult || { ok: false, status: 0, error: "History API unavailable" };
}

async function resolveAccountEmail(baseUrl, loginUsername, requestId) {
  let email = "";

  try {
    const { response, data } = await postJson(
      baseUrl,
      "/api/users/get_user_info",
      {
        request_id: requestId,
        username: loginUsername,
        type: "user_type",
      }
    );

    if (!response.ok) {
      return "";
    }

    const userType = data?.info;
    const infoType = userType === "shared" ? "email_owner" : "email";
    const infoResult = await postJson(baseUrl, "/api/users/get_user_info", {
      request_id: requestId,
      username: loginUsername,
      type: infoType,
    });

    email = String(infoResult?.data?.info || "").trim();
  } catch (error) {
    console.warn("resolveAccountEmail failed:", error);
  }

  return email;
}

async function resolveAccountEmailWithFallback(loginUsername, requestId) {
  for (const baseUrl of ACCOUNT_INFO_API_CANDIDATES) {
    const email = await resolveAccountEmail(baseUrl, loginUsername, requestId);
    if (email) return email;
  }
  return "";
}

async function loginAccountWithFallback(payload) {
  let lastError = null;
  const diagnostics = [];

  for (const baseUrl of LOGIN_API_CANDIDATES) {
    try {
      const result = await postJson(baseUrl, "/api/accounts/login", payload);
      if (result?.response?.ok) {
        return { ok: true, baseUrl, ...result };
      }
      lastError = { ok: false, baseUrl, ...result };
      diagnostics.push(
        `${baseUrl}: HTTP ${result?.response?.status || 0} ${
          result?.data?.detail || result?.data?.message || "request failed"
        }`
      );
    } catch (error) {
      lastError = {
        ok: false,
        baseUrl,
        response: { status: 0 },
        data: { message: String(error) },
      };
      diagnostics.push(`${baseUrl}: ${String(error)}`);
    }
  }

  if (lastError) {
    return {
      ...lastError,
      data: {
        ...(typeof lastError?.data === "object" ? lastError.data : {}),
        message:
          diagnostics.length > 0
            ? `Login API unavailable. ${diagnostics.join(" | ")}`
            : lastError?.data?.message || "Login API unavailable",
      },
    };
  }

  return {
    ok: false,
    response: { status: 0 },
    data: { message: "Login API unavailable" },
  };
}

function makeErrorKey(payload) {
  const msg = payload?.message || "";
  const stack = payload?.stack || "";
  const event = payload?.event || "";
  return `${event}|${msg}|${stack}`.slice(0, 1000);
}

function shouldReportError(key) {
  const now = Date.now();
  const last = errorDedup.get(key);
  if (last && now - last < ERROR_DEDUP_TTL_MS) return false;
  errorDedup.set(key, now);
  if (errorDedup.size > ERROR_DEDUP_MAX) {
    const oldest = [...errorDedup.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) errorDedup.delete(oldest[0]);
  }
  return true;
}

function shouldForwardCaptionMessage(sender, type, payload) {
  const tabId = sender?.tab?.id;
  const frameId = typeof sender?.frameId === "number" ? sender.frameId : 0;
  if (!tabId) return true;

  const now = Date.now();
  const current = captionSourceByTab.get(tabId);
  const hasFinalizedTranscript =
    type === "LIVE_TRANSCRIPT" &&
    payload?.action === "finalize" &&
    String(payload?.finalized || "").trim();
  const hasDetectedCaption =
    type === "CAPTION_STATUS" &&
    (payload?.state === "detected" || payload?.state === "synced");

  if (!current) {
    if (hasFinalizedTranscript || hasDetectedCaption) {
      captionSourceByTab.set(tabId, { frameId, lastSeenAt: now });
    }
    return true;
  }

  if (current.frameId === frameId) {
    current.lastSeenAt = now;
    captionSourceByTab.set(tabId, current);
    return true;
  }

  const isStale = now - current.lastSeenAt > CAPTION_SOURCE_STALE_MS;
  if (isStale && (hasFinalizedTranscript || hasDetectedCaption)) {
    captionSourceByTab.set(tabId, { frameId, lastSeenAt: now });
    return true;
  }

  return false;
}

function normalizeCaptionEventText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isDuplicateCaptionEvent(sender, type, payload) {
  const tabId = sender?.tab?.id;
  if (!tabId) return false;

  if (type !== "LIVE_TRANSCRIPT" || payload?.action !== "finalize") {
    return false;
  }

  const finalized = normalizeCaptionEventText(payload?.finalized || "");
  if (!finalized) return false;

  // Include speaker in the dedup key so that two different speakers
  // saying the same phrase (e.g. "Okay") are NOT silently dropped.
  const speaker = normalizeCaptionEventText(payload?.speaker || "unknown");
  const dedupeKey = `${speaker}::${finalized}`;

  const now = Date.now();
  const store = recentCaptionEventsByTab.get(tabId) || new Map();
  for (const [key, ts] of store.entries()) {
    if (now - ts > RECENT_CAPTION_EVENT_TTL_MS) {
      store.delete(key);
    }
  }

  if (store.has(dedupeKey)) {
    recentCaptionEventsByTab.set(tabId, store);
    return true;
  }

  store.set(dedupeKey, now);
  recentCaptionEventsByTab.set(tabId, store);
  return false;
}

async function reportExtensionError(payload) {
  try {
    const normalized = {
      ...payload,
      ts: payload?.ts || new Date().toISOString(),
      version: payload?.version || EXTENSION_VERSION,
      userAgent: payload?.userAgent || self?.navigator?.userAgent || "",
    };

    const key = makeErrorKey(normalized);
    if (!shouldReportError(key)) return;

    await fetch(`${VITE_URL_BACKEND}${TELEMETRY_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
  } catch (err) {
    console.warn("Telemetry send failed:", err);
  }
}

function resetTimer() {
  startTime = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  if (!startTime) startTime = Date.now();
  if (timerInterval) return;

  timerInterval = setInterval(() => {
    const elapsedMs = Date.now() - startTime;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          { type: "TIMER_UPDATE", payload: { minutes, seconds } },
          () => {}
        );
      });
    });
  }, 1000);
}
const queryTabs = (query) =>
  new Promise((resolve) => chrome.tabs.query(query, resolve));
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("Background received message:", msg);
  switch (msg.type) {
    case "OPEN_MEETING_WINDOW":
      (async () => {
        try {
          const meetingData = msg?.payload?.meetingData || null;
          if (!meetingData || typeof meetingData !== "object") {
            sendResponse({ ok: false, status: 400, error: "Missing meetingData" });
            return;
          }

          try {
            if (chrome.storage?.session) {
              await chrome.storage.session.set({
                ada_detached_meeting_data: meetingData,
              });
            } else if (chrome.storage?.local) {
              await chrome.storage.local.set({
                ada_detached_meeting_data: meetingData,
              });
            }
          } catch (e) {
            console.warn("Failed to persist detached meeting data:", e);
          }

          const url = chrome.runtime.getURL("window.html?view=meeting");
          chrome.windows.create(
            {
              url,
              type: "popup",
              width: 1180,
              height: 820,
            },
            () => {
              sendResponse({ ok: true });
            }
          );
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;

    case "RESET_TIMER":
      resetTimer();
      sendResponse({ ok: true });
      return true;

    case "START_TIMER":
      startTimer();
      sendResponse({ ok: true });
      return true;

    case "GET_TIMER":
      if (!startTime) {
        sendResponse({ minutes: 0, seconds: 0 });
      } else {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);
        sendResponse({
          minutes: Math.floor(elapsedSeconds / 60),
          seconds: elapsedSeconds % 60,
        });
      }
      return true;

    case "NEW_CAPTION":
      latestCaptions = msg.payload;
      sendResponse({ ok: true });
      return true;

    case "LIVE_TRANSCRIPT":
      if (!shouldForwardCaptionMessage(sender, "LIVE_TRANSCRIPT", msg.payload)) {
        sendResponse({ ok: true, ignored: true });
        return true;
      }
      if (isDuplicateCaptionEvent(sender, "LIVE_TRANSCRIPT", msg.payload)) {
        sendResponse({ ok: true, ignored: true, duplicate: true });
        return true;
      }
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, msg, () => {
          sendResponse({ ok: true });
        });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, msg, () => {
              sendResponse({ ok: true });
            });
          } else {
            sendResponse({ ok: false, error: "No target tab found" });
          }
        });
      }
      return true;
    case "CAPTION_STATUS":
      if (!shouldForwardCaptionMessage(sender, "CAPTION_STATUS", msg.payload)) {
        sendResponse({ ok: true, ignored: true });
        return true;
      }
      if (sender?.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, msg, () => {
          sendResponse({ ok: true });
        });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, msg, () => {
              sendResponse({ ok: true });
            });
          } else {
            sendResponse({ ok: false, error: "No target tab found" });
          }
        });
      }
      return true;
    case "REPORT_ERROR":
      reportExtensionError(msg.payload || {});
      sendResponse({ ok: true });
      return true;
    case "OPEN_LANGUAGE_SETTINGS":
      chrome.tabs.create({ url: "chrome://settings/languages" }, () => {
        sendResponse({ ok: true });
      });
      return true;
    case "CHECK_MEET_TAB":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs?.[0]?.url || "";
        const ok = url.startsWith("https://meet.google.com/");
        sendResponse({ ok, url });
      });
      return true;
    case "GET_ACCOUNT_AUTH":
      (async () => {
        try {
          const authState = await readAccountAuthState();
          sendResponse(authState);
        } catch (err) {
          sendResponse({
            loggedIn: false,
            status: 0,
            error: String(err),
          });
        }
      })();
      return true;
    case "LOGIN_ACCOUNT":
      (async () => {
        try {
          const username = String(msg?.payload?.username || "").trim();
          const password = String(msg?.payload?.password || "");
          const requestId = Date.now();

          if (!username || !password) {
            sendResponse({
              ok: false,
              status: 400,
              error: "Username and password are required.",
            });
            return;
          }

          const loginResult = await loginAccountWithFallback({
            username,
            password,
            request_id: requestId,
          });

          if (!loginResult?.response?.ok) {
            sendResponse({
              ok: false,
              status: loginResult?.response?.status || 0,
              error:
                loginResult?.data?.detail ||
                loginResult?.data?.message ||
                "Login failed.",
            });
            return;
          }

          const loginPayload =
            loginResult?.data && typeof loginResult.data === "object"
              ? loginResult.data
              : {};
          const accessToken = String(
            loginPayload?.access_token || loginPayload?.token || ""
          ).trim();
          const loginSucceeded =
            loginPayload?.login === true || Boolean(accessToken);

          if (!loginSucceeded || !accessToken) {
            sendResponse({
              ok: false,
              status: 401,
              error: loginPayload?.message || "Wrong username or password.",
            });
            return;
          }

          const email =
            String(loginPayload?.email || "").trim() ||
            (await resolveAccountEmailWithFallback(username, requestId)) ||
            username;
          const displayName = normalizeDisplayName(username);
          const expiresInSeconds = Number(loginPayload?.expires_in || 0) || null;
          const accountSession = normalizeAccountSession({
            loggedIn: true,
            username: email,
            jwtToken: accessToken,
            loginType: "account",
            name: displayName,
            creditName: username,
            source: "extension",
            expiresAt: expiresInSeconds
              ? Date.now() + expiresInSeconds * 1000
              : null,
          });

          await saveStoredAccountSession(accountSession);
          await mirrorWebsiteSessionCookies(accountSession, expiresInSeconds);

          sendResponse({
            ok: true,
            status: 200,
            data: accountSession,
          });
        } catch (err) {
          sendResponse({
            ok: false,
            status: 0,
            error: String(err),
          });
        }
      })();
      return true;
    case "LOGOUT_ACCOUNT":
      (async () => {
        try {
          await clearStoredAccountSession();
          await clearWebsiteSessionCookies();
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_USER_CLONE":
      (async () => {
        try {
          const { email } = msg.payload || {};
          const res = await fetch(`${VITE_URL_BACKEND}/api/profiles/primary`, {
            headers: email ? { username: email } : {},
            credentials: "include",
          });
          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_PROFILES":
      (async () => {
        try {
          const { email } = msg.payload || {};
          const res = await fetch(`${VITE_URL_BACKEND}/api/profiles`, {
            headers: email ? { username: email } : {},
            credentials: "include",
          });
          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_PROFILE_INTEL":
      (async () => {
        try {
          const { profileId, email } = msg.payload || {};
          if (!profileId) {
            sendResponse({ ok: false, status: 400, error: "Missing profileId" });
            return;
          }
          sendResponse({
            ok: false,
            status: 404,
            error: "check-intel endpoint not available",
          });
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_CONVERSION_ARCHITECT_FILES":
      (async () => {
        try {
          const authState = await readAccountAuthState();
          console.log("GET_CONVERSION_ARCHITECT_FILES authState:", {
            loggedIn: authState?.loggedIn,
            username: authState?.username,
            loginType: authState?.loginType,
          });
          if (!authState?.username || !authState?.jwtToken) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Please sign in first.",
            });
            return;
          }

          const take = Number(msg?.payload?.take || 50);
          const result = await fetchHistoryWithFallback("/api/v1/tool-history/get", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authState.jwtToken}`,
              username: authState.username,
            },
            body: JSON.stringify({
              take,
              skip: 0,
              filterToolName: [
                "Conversion Architect",
                "AI Conversion Architect",
                "Sales Trinity",
              ],
            }),
          });

          sendResponse(result);
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_CONVERSION_ARCHITECT_FILE":
      (async () => {
        try {
          const fileId = String(msg?.payload?.fileId || "").trim();
          const authState = await readAccountAuthState();
          console.log("GET_CONVERSION_ARCHITECT_FILE authState:", {
            loggedIn: authState?.loggedIn,
            username: authState?.username,
            loginType: authState?.loginType,
          });

          if (!fileId) {
            sendResponse({
              ok: false,
              status: 400,
              error: "Missing fileId",
            });
            return;
          }

          if (!authState?.username || !authState?.jwtToken) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Please sign in first.",
            });
            return;
          }

          const result = await fetchHistoryWithFallback(
            `/api/v1/tool-history/get/${encodeURIComponent(fileId)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${authState.jwtToken}`,
                username: authState.username,
              },
            }
          );

          sendResponse(result);
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;
    case "GET_QUOTA":
      (async () => {
        try {
          const { email, add_on_type } = msg.payload || {};
          if (email && add_on_type) {
            const fallbackRes = await fetch(
              `${VITE_URL_BACKEND}/api/addons/get_addon_sessions`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, add_on_type }),
              }
            );
            const fallbackRaw = await fallbackRes.text();
            let fallbackData;
            try {
              fallbackData = JSON.parse(fallbackRaw);
            } catch {
              fallbackData = fallbackRaw;
            }
            const remaining = fallbackData?.content?.value ?? 0;
            sendResponse({
              ok: false,
              fallback: { remaining },
            });
            return;
          }
          sendResponse({ ok: false, status: res.status });
        } catch (err) {
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;

    case "LOGIN_GOOGLE":
      chrome.identity.launchWebAuthFlow(
        { url: urlConnect, interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError || !redirectUrl) {
            sendResponse({
              error: chrome.runtime.lastError?.message || "Login failed",
            });
            return;
          }
          const m = redirectUrl.match(/access_token=([^&]+)/);
          sendResponse({ token: m ? m[1] : null });
        }
      );
      return true;

    case "GET_REMAIN_SESSIONS":
      const { email, add_on_type } = msg.payload;
      fetch(`${VITE_URL_BACKEND}/api/addons/get_addon_sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, add_on_type }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("GET_REMAIN_SESSIONS response:", data);
          sendResponse({ data });
        })
        .catch((err) => sendResponse({ data: null, error: err.message }));
      return true;

    case "USE_ADDON_SESSION":
      const { email: userEmail, add_on_type: addonType } = msg.payload;
      fetch(`${VITE_URL_BACKEND}/api/addons/use_addon_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, add_on_type: addonType }),
      })
        .then((res) => res.json())
        .then((data) => sendResponse({ data }))
        .catch((err) => sendResponse({ data: null, error: err.message }));
      return true;

    case "GET_MEETING_PREPARE":
      const { email: meetingEmail } = msg.payload;
      fetch(
        `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
          meetingEmail
        )}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!data || !data.meeting) {
            sendResponse({ data: { meeting: { meetings: [] } } });
          } else {
            sendResponse({ data });
          }
        })
        .catch((err) =>
          sendResponse({
            data: { meeting: { meetings: [] } },
            error: err.message,
          })
        );

      return true; // giữ sendResponse mở

    case "UPDATE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, meetingId, payload } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/update_meeting_prepare/${encodeURIComponent(
              email
            )}/${meetingId}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meetings: [payload] }),
            }
          );

          if (!res.ok) throw new Error("Update failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "DELETE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, meetingId } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/delete_meeting_prepare/${encodeURIComponent(
              email
            )}/${meetingId}`,
            { method: "DELETE" }
          );

          if (!res.ok) throw new Error("Delete failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });

          // Sau khi xoá thì fetch lại danh sách mới
          const res2 = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/get_meeting_prepare/${encodeURIComponent(
              email
            )}`
          );
          const newData = await res2.json();
          chrome.runtime.sendMessage({
            type: "REFRESH_BLOCKS",
            payload: newData.meeting?.meetings || [],
          });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "CREATE_MEETING_PREPARE":
      (async function() {
        try {
          const { email, payload } = msg.payload;
          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/create_meeting_prepare/${encodeURIComponent(
              email
            )}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username: email, meetings: [payload] }),
            }
          );

          if (!res.ok) throw new Error("Create failed: " + res.status);

          const data = await res.json();
          sendResponse({ data });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "SEND_MESSAGE_TO_AGENT":
      (async () => {
        try {
          const tabs = await queryTabs({
            url: "https://meet.google.com/*",
            active: true,
            currentWindow: true,
          });

          if (!tabs.length) {
            reportExtensionError({
              event: "agent_request_no_meet_tab",
              message: "Not on a Google Meet tab",
              source: "background",
            });
            sendResponse({ error: "Not on a Google Meet tab" });
            return;
          }

          const {
            meetingData,
            chatHistory,
            log,
            finalizedMessage,
            uiTimer,
            overrideCommand,
          } =
            msg.payload || {};

          const payload = {
            ...meetingData,
            meetingLog: Array.isArray(log) ? log.join("\n") : String(log || ""),
            msg: Array.isArray(chatHistory) ? chatHistory : [],
            finalizedMessage,
            uiTimer,
            overrideCommand,
            user_override: Boolean(overrideCommand),
          };
          const selectedModelKey = meetingData?.agentModelKey || "gemini";
          const agentEndpoint = getAiDialogueAgentEndpoint(selectedModelKey);

          const response = await fetch(
            `${VITE_URL_BACKEND}${agentEndpoint}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );

          // nếu BE lỗi thì vẫn đọc text để trả về UI debug nhanh
          if (!response.ok) {
            const t = await response.text().catch(() => "");
            reportExtensionError({
              event: "agent_request_http_error",
              message: t || `HTTP ${response.status}`,
              source: "background",
              url: tabs[0]?.url || "",
              context: {
                status: response.status,
                endpoint: agentEndpoint,
                modelKey: selectedModelKey,
              },
              userEmail: meetingData?.email || meetingData?.userEmail || "",
            });
            sendResponse({ error: t || `HTTP ${response.status}` });
            return;
          }

          const data = await response.json();
          sendResponse({ data });
        } catch (err) {
          reportExtensionError({
            event: "agent_request_exception",
            message: err?.message || String(err),
            stack: err?.stack || "",
            source: "background",
            context: { endpoint: "SEND_MESSAGE_TO_AGENT" },
          });
          sendResponse({ error: err?.message || String(err) });
        }
      })();

      return true;
    case "SEND_MESSAGE_TO_AGENT_STREAM":
      (async () => {
        try {
          chrome.tabs.query(
            {
              url: "https://meet.google.com/*",
              active: true,
              currentWindow: true,
            },
            async (tabs) => {
              if (!tabs.length) {
                sendResponse({ error: "Not on a Google Meet tab" });
                return;
              }

              const activeTabId = tabs[0].id;
              const {
                meetingData,
                chatHistory,
                log,
                requestId,
                finalizedMessage,
                overrideCommand,
              } = msg.payload;

              const payload = {
                ...meetingData,
                meetingLog: Array.isArray(log)
                  ? log.join("\n")
                  : String(log || ""),
                msg: Array.isArray(chatHistory) ? chatHistory : [],
                finalizedMessage,
                overrideCommand,
                user_override: Boolean(overrideCommand),
              };
              const selectedModelKey = meetingData?.agentModelKey || "gemini";

              if (selectedModelKey !== "groq") {
                const agentEndpoint = getAiDialogueAgentEndpoint(selectedModelKey);
                const res = await fetch(
                  `${VITE_URL_BACKEND}${agentEndpoint}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  }
                );

                if (!res.ok) {
                  const text = await res.text().catch(() => "");
                  reportExtensionError({
                    event: "agent_stream_http_error",
                    message: text || `HTTP ${res.status}`,
                    source: "background",
                    url: tabs[0]?.url || "",
                    context: {
                      status: res.status,
                      endpoint: agentEndpoint,
                      modelKey: selectedModelKey,
                    },
                    userEmail:
                      meetingData?.email || meetingData?.userEmail || "",
                  });
                  chrome.tabs.sendMessage(activeTabId, {
                    type: "AGENT_STREAM_ERROR",
                    payload: text || `HTTP ${res.status}`,
                    requestId,
                  });
                  sendResponse({ ok: false, error: text });
                  return;
                }

                const data = await res.json().catch(() => ({}));
                const content =
                  data?.content ??
                  data?.data?.content ??
                  data?.text ??
                  "";

                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_CHUNK",
                  payload: { delta: String(content || ""), requestId },
                });
                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_DONE",
                  payload: { requestId },
                });
                sendResponse({ ok: true });
                return;
              }

              const res = await fetch(
                `${VITE_URL_BACKEND}/api/content-generators/ai_dialogue_architect_agent_stream`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }
              );

              if (!res.ok || !res.body) {
                const text = await res.text().catch(() => "");
                reportExtensionError({
                  event: "agent_stream_http_error",
                  message: text || `HTTP ${res.status}`,
                  source: "background",
                  url: tabs[0]?.url || "",
                  context: {
                    status: res.status,
                    endpoint:
                      "/api/content-generators/ai_dialogue_architect_agent_stream",
                  },
                  userEmail: meetingData?.email || meetingData?.userEmail || "",
                });
                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_ERROR",
                  payload: text || `HTTP ${res.status}`,
                  requestId,
                });
                sendResponse({ ok: false, error: text });
                return;
              }

              // báo cho FE là stream đã start (optional)
              chrome.tabs.sendMessage(activeTabId, {
                type: "AGENT_STREAM_START",
                payload: { requestId },
              });

              const reader = res.body.getReader();
              const decoder = new TextDecoder("utf-8");

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });

                chrome.tabs.sendMessage(activeTabId, {
                  type: "AGENT_STREAM_CHUNK",
                  payload: { delta: chunk, requestId },
                });
              }

              // báo end
              chrome.tabs.sendMessage(activeTabId, {
                type: "AGENT_STREAM_DONE",
                payload: { requestId },
              });

              sendResponse({ ok: true });
            }
          );
        } catch (err) {
          reportExtensionError({
            event: "agent_stream_exception",
            message: String(err),
            stack: err?.stack || "",
            source: "background",
            context: { endpoint: "SEND_MESSAGE_TO_AGENT_STREAM" },
          });
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;

    case "SAVE_MEETING_TRANSCRIPT":
      (async function() {
        try {
          let { email, meetingId, transcriptText, transcriptId } = msg.payload;
          if (!meetingId) {
            sendResponse({ error: "Missing meetingId" });
            return;
          }

          const res = await fetch(
            `${VITE_URL_BACKEND}/api/meeting_prepare/upsert_transcript/${encodeURIComponent(
              email
            )}/${meetingId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                meeting_transcript: transcriptText,
                transcript_id: transcriptId || null,
              }),
            }
          );

          if (!res.ok) throw new Error("Save meeting failed");

          const data = await res.json();
          sendResponse({ data });
        } catch (err) {
          sendResponse({ error: err.message });
        }
      })();
      return true;

    case "SALE_PROSPECT_REQUEST":
      (async () => {
        try {
          const { payload } = msg;

          const res = await fetch(
            `${VITE_URL_BACKEND}/api/analyze/prospect-psychology`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: payload?.name || "",
                biography: payload?.biography || "",
                urls:
                  payload?.socialMediaUrl?.map((x) => x.socialMediaUrl) || [],
                msg: payload?.msg || [],
              }),
            }
          );

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({
            ok: res.ok,
            status: res.status,
            data,
          });
        } catch (err) {
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();

      return true;

    case "BUSINESS_DNA_REQUEST":
      (async () => {
        try {
          const { payload } = msg;
          const url = `${VITE_URL_BACKEND}/api/analyze/business-dna`;

          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(payload?.username ? { username: payload.username } : {}),
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_ME":
      (async () => {
        try {
          const { app_token } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          // 1) Lấy Google access_token cho app ai_dialogue_calendar
          const tokRes = await fetch(
            `${VITE_URL_BACKEND}/api/oauth2/google/token?app=ai_dialogue_calendar`,
            {
              headers: {
                Authorization: `Bearer ${app_token}`,
              },
            }
          );

          if (!tokRes.ok) {
            const t = await tokRes.text().catch(() => "");
            console.warn("[AI_DIALOGUE_ME] /token failed:", tokRes.status, t);
            sendResponse({ ok: false, status: tokRes.status, error: t });
            return;
          }

          const tok = await tokRes.json().catch(() => ({}));
          const access_token = tok.access_token;
          if (!access_token) {
            console.warn("[AI_DIALOGUE_ME] /token no access_token:", tok);
            sendResponse({
              ok: false,
              status: 500,
              error: "No access_token from /token",
            });
            return;
          }

          // 2) Gọi Google UserInfo để lấy profile (name/email/picture)
          const uiRes = await fetch(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            {
              headers: { Authorization: `Bearer ${access_token}` },
            }
          );

          if (!uiRes.ok) {
            const t = await uiRes.text().catch(() => "");
            console.warn("[AI_DIALOGUE_ME] userinfo failed:", uiRes.status, t);
            sendResponse({ ok: false, status: uiRes.status, error: t });
            return;
          }

          const user = await uiRes.json();

          sendResponse({
            ok: true,
            status: 200,
            user,
          });
        } catch (err) {
          console.warn("[AI_DIALOGUE_ME] exception:", err);
          sendResponse({ ok: false, status: 0, error: String(err) });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_CREATE":
      (async () => {
        try {
          const { app_token, payload } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/create`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${app_token}`, // 👈 chính là app_token
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_CREATE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_UPDATE":
      (async () => {
        try {
          const { app_token, payload } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/update`;
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${app_token}`,
            },
            body: JSON.stringify(payload),
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_UPDATE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;

    case "AI_DIALOGUE_CALENDAR_DELETE":
      (async () => {
        try {
          const { app_token, event_id } = msg;
          if (!app_token) {
            sendResponse({
              ok: false,
              status: 401,
              error: "Missing app_token",
            });
            return;
          }
          if (!event_id) {
            sendResponse({
              ok: false,
              status: 400,
              error: "Missing event_id",
            });
            return;
          }

          const url = `${VITE_URL_BACKEND}/api/calendar/event/${encodeURIComponent(
            event_id
          )}`;

          const res = await fetch(url, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${app_token}`,
            },
          });

          const raw = await res.text();
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }

          console.log("[AI_DIALOGUE_CALENDAR_DELETE] BE response:", data);
          sendResponse({ ok: res.ok, status: res.status, data });
        } catch (err) {
          console.error("[AI_DIALOGUE_CALENDAR_DELETE] error:", err);
          sendResponse({
            ok: false,
            status: 0,
            data: `Background fetch error: ${String(err)}`,
          });
        }
      })();
      return true;
// ===== ADD: Refresh Meet caption DOM =====
case "REFRESH_MEET_CAPTION_DOM":
  chrome.tabs.query({ url: "https://meet.google.com/*" }, (tabs) => {
    if (!tabs?.length) {
      sendResponse({
        ok: false,
        error: "No Google Meet tab found (https://meet.google.com/*)",
        details: { tabsFound: 0 },
      });
      return;
    }

    // ưu tiên active tab trong current window nếu có
    const activeTab = tabs.find((t) => t.active) || tabs[0];

    chrome.tabs.sendMessage(
      activeTab.id,
      { type: "REFRESH_CAPTION_OBSERVER" },
      (details) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            ok: false,
            error: `[tabs.sendMessage error] ${chrome.runtime.lastError.message}`,
            details: { tabId: activeTab.id },
          });
          return;
        }
        sendResponse({ ok: true, details: details || null });
      }
    );
  });
  return true;

    default:
      if (msg.action === "pushCaption") {
        sharedCaptions.push(msg.data);
      } else if (msg.action === "getCaptions") {
        sendResponse({ captions: sharedCaptions });
        return true;
      } else if (msg.action === "CHECK_COOKIE") {
        (async () => {
          const authState = await readAccountAuthState();
          sendResponse(
            authState?.loggedIn
              ? { loggedIn: true, username: authState.username }
              : { loggedIn: false }
          );
        })();
        return true;
      }
      return true;
  }
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["main.js"],
  });
});
