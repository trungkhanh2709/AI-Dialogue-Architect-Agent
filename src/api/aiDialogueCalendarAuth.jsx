// src/api/aiDialogueCalendarAuth.jsx

// const API_BASE = "https://api-as.reelsightsai.com";
 const API_BASE = "http://localhost:4000"; // hoặc localhost nếu dev

const APP_KEY = "ai_dialogue_calendar";
const STORAGE_KEY = "ai_dialogue_calendar_app_token_v1";

let loginInFlight = null;
let renewInFlight = null;

// =============== Local storage helpers ===============
async function saveAppToken(tokenSet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokenSet || null));
  } catch (e) {
    console.warn("[calendar-oauth] saveAppToken failed:", e);
  }
}

export async function loadAppToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAppToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[calendar-oauth] clearAppToken failed:", e);
  }
}

// =============== JWT utils ===============
function safeDecodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(payloadB64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpired(tokenSet) {
  if (!tokenSet || !tokenSet.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= tokenSet.exp;
}

// =============== Core auth ===============
export async function signInCalendarAndGetAppToken() {
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    const cached = await loadAppToken();
    // nếu token còn hạn → dùng luôn
    const now = Math.floor(Date.now() / 1000);
    const slack = 300;
    if (cached && cached.app_token && cached.exp && now <= cached.exp - slack) {
      const ok = await isCalendarSignedIn();
      if (ok) return cached.app_token;
    }

    // mở popup OAuth
    const popup = window.open(
      `${API_BASE}/api/oauth2/google/start?app=${APP_KEY}&target=popup`,
      "rsai_oauth_popup",
      "width=480,height=640"
    );
    if (!popup) throw new Error("Cannot open OAuth popup");

    const token = await new Promise((resolve, reject) => {
      let done = false;

      function cleanup() {
        if (done) return;
        done = true;
        window.removeEventListener("message", onMsg);
      }

      async function onMsg(ev) {
        const msg = ev.data;
        if (!msg || msg.source !== "rsai-oauth" || !msg.data) return;

        const { app_token, app, user_id } = msg.data || {};
        if (!app_token || app !== APP_KEY) return;

        try {
          const payload = safeDecodeJwt(app_token) || {};
          await saveAppToken({
            app_token,
            app,
            user_id,
            iat: Number(payload.iat) || undefined,
            exp: Number(payload.exp) || undefined,
          });

          // notify UI
          window.postMessage({ type: "OAUTH_DONE" }, "*");
          cleanup();
          resolve(app_token);
        } catch (e) {
          cleanup();
          reject(e);
        }
      }

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

export async function isCalendarSignedIn() {
  const t = await loadAppToken();
  if (!t || !t.app_token) return false;

  const now = Math.floor(Date.now() / 1000);
  const slack = 300;
  if (t.exp && now <= t.exp - slack) return true;

  // thử renew
  const renewed = await renewCalendarAppTokenIfNeeded();
  if (renewed) return true;

  // fallback hỏi BE
  try {
    const resp = await fetch(`${API_BASE}/api/oauth2/google/me`, {
      headers: { Authorization: `Bearer ${t.app_token}` },
    });
    if (resp.ok) return true;
    if (resp.status === 401) await clearAppToken();
  } catch (e) {
    console.warn("[calendar-oauth] /me check failed:", e);
  }
  return false;
}

async function renewCalendarAppTokenIfNeeded() {
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

      const payload = safeDecodeJwt(newToken) || {};
      await saveAppToken({
        app_token: newToken,
        app: APP_KEY,
        user_id: t.user_id,
        iat: Number(payload.iat) || undefined,
        exp: Number(payload.exp) || undefined,
      });
      return newToken;
    } catch (e) {
      console.warn("[calendar-oauth] renew failed:", e);
      return null;
    } finally {
      renewInFlight = null;
    }
  })();

  const res = await renewInFlight;
  return !!res;
}

export async function ensureSignedIn() {
  const ok = await isCalendarSignedIn();
  if (ok) {
    const t = await loadAppToken();
    return t && t.app_token;
  }
  return await signInCalendarAndGetAppToken();
}

// =============== Short-lived Google access_token ===============
export async function getShortLivedCalendarAccessToken() {
  const appToken = await ensureSignedIn();
  if (!appToken) throw new Error("Not signed in");

  const r = await fetch(
    `${API_BASE}/api/oauth2/google/token?app=${APP_KEY}`,
    {
      headers: { Authorization: `Bearer ${appToken}` },
    }
  );
  if (!r.ok) {
    if (r.status === 401) {
      await clearAppToken();
    }
    throw new Error(
      `Cannot get Google access token (status ${r.status})`
    );
  }
  const js = await r.json().catch(() => ({}));
  if (!js.access_token) {
    throw new Error("No access_token returned by backend");
  }
  return js.access_token;
}

// =============== User info (name, email, picture) ===============
export async function getCalendarUser() {
  const t = await loadAppToken();
  if (!t || !t.app_token) return null;

  try {
    const accessToken = await getShortLivedCalendarAccessToken();
    const resp = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!resp.ok) throw new Error("userinfo failed");
    const user = await resp.json();
    return {
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
  } catch (e) {
    console.warn("[calendar-oauth] userinfo via google failed, fallback /me:", e);
    try {
      const resp = await fetch(`${API_BASE}/api/oauth2/google/me`, {
        headers: { Authorization: `Bearer ${t.app_token}` },
      });
      if (!resp.ok) return null;
      const js = await resp.json().catch(() => ({}));
      const u = js.user || js;
      return {
        sub: u.sub,
        email: u.email,
        name: u.name,
        picture: u.picture,
      };
    } catch {
      return null;
    }
  }
}

// =============== Logout ===============
export async function signOutCalendar() {
  const t = await loadAppToken();
  try {
    if (t && t.app_token) {
      await fetch(
        `${API_BASE}/api/oauth2/google/logout?app=${APP_KEY}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${t.app_token}` },
        }
      );
    }
  } catch (e) {
    console.warn("[calendar-oauth] remote logout failed (ignored):", e);
  }
  await clearAppToken();
}
