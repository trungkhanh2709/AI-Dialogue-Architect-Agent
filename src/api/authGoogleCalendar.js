// Không dùng TS ở đây để tránh lỗi build

const API_BASE = "http://localhost:4000"; // hoặc domain BE của bạn
const STORAGE_KEY = "rsai_ai_dialogue_calendar_token_v1";

let loginInFlight = null;
let renewInFlight = null;

// ===== Helpers storage an toàn =====
function getChromeStorageLocal() {
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      return chrome.storage.local;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

async function saveAppToken(t) {
  const cs = getChromeStorageLocal();
  if (cs) {
    await cs.set({ [STORAGE_KEY]: t });
  } else {
    // fallback web
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  }
}

export async function loadAppToken() {
  const cs = getChromeStorageLocal();
  if (cs) {
    const obj = await cs.get(STORAGE_KEY);
    return (obj && obj[STORAGE_KEY]) || null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAppToken() {
  const cs = getChromeStorageLocal();
  if (cs) {
    await cs.remove(STORAGE_KEY);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// ===== JWT utils =====
function safeDecodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const json = JSON.parse(atob(payloadB64));
    return json;
  } catch (e) {
    return null;
  }
}

function isExpired(t) {
  if (!t || !t.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= t.exp;
}

// ===== Sign in =====
export async function signInAndGetCalendarToken() {
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    const cached = await loadAppToken();
    if (cached && cached.app_token) {
      const ok = await isSignedInCalendar();
      if (ok) return cached.app_token;
    }

    const popup = window.open(
      `${API_BASE}/api/oauth2/google/start?app=ai_dialogue_calendar&target=popup`,
      "rsai_oauth_ai_dialogue",
      "width=480,height=640"
    );
    if (!popup) throw new Error("Cannot open OAuth popup");

    const token = await new Promise((resolve, reject) => {
      let done = false;

      const onMsg = async (ev) => {
        const msg = ev && ev.data;
        if (!msg) return;

        // Back-end callback payload:
        // { source: "rsai-oauth", data: { app, app_token, user_id, ... } }
        if (msg.source !== "rsai-oauth" || !msg.data) return;

        const { app_token, user_id, app } = msg.data || {};
        if (!app_token || app !== "ai_dialogue_calendar") return;

        const payload = safeDecodeJwt(app_token);

        try {
          await saveAppToken({
            app_token,
            user_id,
            iat: Number(payload && payload.iat) || undefined,
            exp: Number(payload && payload.exp) || undefined,
          });

          window.postMessage({ type: "OAUTH_DONE_AI_DIALOGUE" }, "*");
          resolve(app_token);
        } catch (e) {
          reject(e);
        } finally {
          cleanup();
        }
      };

      const cleanup = () => {
        done = true;
        window.removeEventListener("message", onMsg);
      };

      window.addEventListener("message", onMsg);

      setTimeout(() => {
        if (!done) {
          cleanup();
          reject(new Error("Login timeout"));
        }
      }, 120000);
    });

    return token;
  })().finally(() => {
    loginInFlight = null;
  });

  return loginInFlight;
}

// ===== Renew app_jwt =====
async function renewAppTokenIfNeeded() {
  const t = await loadAppToken();
  if (!t || !t.app_token) return false;

  if (renewInFlight) {
    const res = await renewInFlight;
    return !!res;
  }

  renewInFlight = (async () => {
    try {
      const r = await fetch(`${API_BASE}/api/oauth2/google/renew_app_token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t.app_token}` },
      });
      if (!r.ok) return null;

      const js = await r.json().catch(() => ({}));
      const newToken = js && js.app_token;
      if (!newToken) return null;

      const payload = safeDecodeJwt(newToken);
      const old = (await loadAppToken()) || {};

      await saveAppToken({
        app_token: newToken,
        user_id: old.user_id,
        iat: Number(payload && payload.iat) || undefined,
        exp: Number(payload && payload.exp) || undefined,
      });

      return newToken;
    } catch (e) {
      return null;
    } finally {
      renewInFlight = null;
    }
  })();

  const res = await renewInFlight;
  return !!res;
}

// ===== Check signed-in =====
export async function isSignedInCalendar() {
  const t = await loadAppToken();
  if (!t || !t.app_token) return false;

  const now = Math.floor(Date.now() / 1000);
  const slack = 300;
  if (t.exp && now <= t.exp - slack) return true;

  const renewed = await renewAppTokenIfNeeded();
  if (renewed) return true;

  try {
    const resp = await fetch(`${API_BASE}/api/oauth2/google/me`, {
      headers: { Authorization: `Bearer ${t.app_token}` },
    });
    if (resp.ok) return true;
    if (resp.status === 401) await clearAppToken();
  } catch (e) {
    console.warn("[ai-dialogue] /me check failed:", e);
  }
  return false;
}

export async function signOutCalendarApp() {
  try {
    const stored = await loadAppToken();

    // Gọi BE xoá token Google (optional, lỗi cũng bỏ qua)
    if (stored && stored.app_token) {
      try {
        await fetch(
          `${API_BASE}/api/oauth2/google/logout?app=ai_dialogue_calendar`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${stored.app_token}`,
            },
          }
        );
      } catch (e) {
        console.warn("[ai-dialogue] logout backend failed (ignored):", e);
      }
    }
  } finally {
    console.log("[ai-dialogue] clearing local app token for calendar");
    await clearAppToken();
  }
}


function canUseChromeRuntime() {
  try {
    return (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.id &&
      typeof chrome.runtime.sendMessage === "function"
    );
  } catch {
    return false;
  }
}

export async function getAiDialogueGoogleUser() {
  const stored = await loadAppToken();
  if (!stored || !stored.app_token || isExpired(stored)) return null;

  // Chạy trong extension: dùng background để tránh CORS
  if (canUseChromeRuntime()) {
    return await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "AI_DIALOGUE_ME",
            app_token: stored.app_token,
          },
          (res) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[ai-dialogue] AI_DIALOGUE_ME error:",
                chrome.runtime.lastError.message
              );
              return resolve(null);
            }

            if (!res) {
              console.warn("[ai-dialogue] AI_DIALOGUE_ME: empty response");
              return resolve(null);
            }

            if (!res.ok) {
              console.warn(
                "[ai-dialogue] AI_DIALOGUE_ME !ok:",
                res.status,
                res.error
              );
              if (res.status === 401) clearAppToken();
              return resolve(null);
            }

            const u = res.user;
            if (!u) {
              console.warn(
                "[ai-dialogue] AI_DIALOGUE_ME: no user field",
                res
              );
              return resolve(null);
            }

            resolve({
              sub: u.sub || u.id,
              email: u.email,
              name: u.name,
              picture: u.picture,
            });
          }
        );
      } catch (e) {
        console.warn("[ai-dialogue] sendMessage AI_DIALOGUE_ME failed:", e);
        resolve(null);
      }
    });
  }

  // Fallback: gọi trực tiếp /me khi chạy ngoài Gmail/Meet (dev page riêng)
  try {
    const meRes = await fetch(`${API_BASE}/api/oauth2/google/me`, {
      headers: { Authorization: `Bearer ${stored.app_token}` },
    });

    if (meRes.ok) {
      const js = await meRes.json().catch(() => ({}));
      const u = js.user || js;
      if (!u) return null;

      return {
        sub: u.sub || u.id,
        email: u.email,
        name: u.name,
        picture: u.picture,
      };
    }

    if (meRes.status === 401) {
      await clearAppToken();
    }
  } catch (e) {
    console.warn("[ai-dialogue] direct /me failed:", e);
  }

  return null;
}



