const BACKEND_URL = 'https://vega-jobs.onrender.com';

let candidateProfile = null;
let authToken = null;

// Authenticated fetch — always sends Bearer token
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...options, headers });
}

// ── Record-as-applied helpers ────────────────────────────────────────────────
// Clicking Autofill means the user is applying, so we record the position as
// "Applied". The backend normalizes the URL, dedupes, and upgrades any existing
// "To Apply" entry — so the next evaluate fires the "already applied" alert.

function titleCase(s) {
  return (s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Best-effort company name from common ATS URLs (Lever, Greenhouse, Ashby,
// Workday, iCIMS, *.applytojob.com) when scraping can't determine it.
function inferCompanyFromUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.split('/').filter(Boolean);
    if (/(lever\.co|greenhouse\.io|ashbyhq\.com|myworkdayjobs\.com|icims\.com|jobvite\.com|smartrecruiters\.com)$/i.test(host)) {
      if (path[0] && !/^apply$/i.test(path[0])) return titleCase(path[0]);
    }
    const sub = host.split('.')[0];
    if (sub && !['jobs', 'boards', 'careers', 'apply', 'job', 'www', 'app'].includes(sub.toLowerCase())) {
      return titleCase(sub);
    }
    if (path[0]) return titleCase(path[0]);
    return titleCase(host.split('.')[0]);
  } catch (e) { return ''; }
}

// Parse "Job Title at Company" / "Job Title - Company" from a page <title>.
function deriveFromTitle(title) {
  let t = (title || '').trim()
    .replace(/^Job Application for\s+/i, '')
    .replace(/^Apply(?:\s*[-–|:])?\s*/i, '');
  let jobTitle = '', companyName = '';
  if (/\sat\s/i.test(t)) {
    const parts = t.split(/\sat\s/i);
    jobTitle = parts[0].trim();
    companyName = (parts[1] || '').split(/[|\-–]/)[0].trim();
  } else if (/[|\-–]/.test(t)) {
    const parts = t.split(/[|\-–]/);
    jobTitle = parts[0].trim();
    companyName = (parts[1] || '').trim();
  } else {
    jobTitle = t;
  }
  return { jobTitle, companyName };
}

// Scrape (server) → fall back to live tab title + URL → save as Applied.
// Returns { saved | updated | alreadyApplied | error, jobTitle, companyName }.
async function saveCurrentTabAsApplied(tab) {
  if (!tab || !tab.url) return { error: 'No active tab URL' };

  let companyName = '', jobTitle = '', location = '', salaryRange = '';

  // 1) Primary: server-side scrape.
  try {
    const formData = new FormData();
    formData.append('url', tab.url);
    const parseRes = await authFetch(`${BACKEND_URL}/api/applications/autofill`, { method: 'POST', body: formData });
    if (parseRes.ok) {
      const parsed = await parseRes.json();
      companyName = parsed.companyName || '';
      jobTitle = parsed.jobTitle || '';
      location = parsed.location || '';
      salaryRange = parsed.salaryRange || '';
    }
  } catch (e) {
    logDebug('Apply-save: server scrape failed — ' + e.message);
  }

  // 2) Fallbacks for ATS/SPA pages the server can't render. The URL is the most
  //    reliable company signal for known ATS hosts; the page title gives the role.
  const fromTitle = deriveFromTitle(tab.title);
  const fromUrl = inferCompanyFromUrl(tab.url);
  if (!jobTitle || /unknown/i.test(jobTitle)) jobTitle = fromTitle.jobTitle || jobTitle;
  if (!companyName || /unknown/i.test(companyName)) companyName = fromUrl || fromTitle.companyName || companyName;
  // "Company - Role" titles can land the company in the jobTitle slot; if the
  // role we derived is just the company name, use the other half of the title.
  const norm = (s) => (s || '').trim().toLowerCase();
  if (companyName && norm(jobTitle) === norm(companyName) && fromTitle.companyName && norm(fromTitle.companyName) !== norm(companyName)) {
    jobTitle = fromTitle.companyName;
  }
  if (!jobTitle) jobTitle = 'Application';
  if (!companyName) return { error: 'Could not determine the company for this page.' };

  // 3) Save as Applied.
  const saveRes = await authFetch(`${BACKEND_URL}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyName, jobTitle, jobUrl: tab.url, location, salaryRange,
      status: 'Applied', dateApplied: new Date().toISOString()
    })
  });
  const data = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok) {
    // The backend rejects re-saving a URL already in the pipeline — for our
    // purposes that means it's already applied, which is exactly what we want.
    if ((data.error || '').toLowerCase().includes('already')) {
      return { alreadyApplied: true, jobTitle, companyName };
    }
    throw new Error(data.error || `Save error: ${saveRes.status}`);
  }
  return { saved: !data.updated, updated: !!data.updated, jobTitle, companyName };
}

// Inject an on-page toast (top frame) confirming the record-as-applied outcome,
// so the user gets visible feedback without opening the popup.
async function showApplyToastInTab(tabId, result) {
  if (!tabId || !result) return;
  let kind, message;
  if (result.error) {
    kind = 'warn'; message = `⚠️ Couldn't record as applied: ${result.error}`;
  } else if (result.alreadyApplied) {
    kind = 'applied'; message = `🚨 Already applied: ${result.jobTitle} at ${result.companyName}`;
  } else {
    kind = 'success'; message = `✅ ${result.updated ? 'Marked applied' : 'Recorded as applied'}: ${result.jobTitle} at ${result.companyName}`;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, kind) => {
        const colors = {
          success: ['#ecfdf5', '#065f46', '#a7f3d0'],
          applied: ['#fef2f2', '#991b1b', '#fecaca'],
          warn:    ['#fffbeb', '#92400e', '#fcd34d'],
        };
        const [bg, color, border] = colors[kind] || colors.success;
        const id = 'vega-apply-toast';
        const prior = document.getElementById(id);
        if (prior) prior.remove();
        const toast = document.createElement('div');
        toast.id = id;
        toast.textContent = msg;
        toast.style.cssText = `
          position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
          background-color: ${bg}; color: ${color}; border: 1px solid ${border};
          padding: 12px 18px; border-radius: 8px; max-width: 360px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
          font-weight: 500; pointer-events: none; transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 5000);
      },
      args: [message, kind],
    });
  } catch (e) { /* tab may not allow injection (chrome:// pages, etc.) */ }
}

function logDebug(msg) {
  console.log(msg);
  const logsEl = document.getElementById('debugLogs');
  if (logsEl) {
    logsEl.value += `[${new Date().toLocaleTimeString()}] ${msg}\n`;
    logsEl.scrollTop = logsEl.scrollHeight;
  }
}

window.onerror = function(message, source, lineno, colno, error) {
  const errorEl = document.getElementById('errorMsg');
  if (errorEl) errorEl.textContent = `JS Error: ${message} at line ${lineno}`;
  return false;
};

document.addEventListener('DOMContentLoaded', async () => {
  const loginSection  = document.getElementById('loginSection');
  const mainSection   = document.getElementById('mainSection');
  const statusEl      = document.getElementById('status');
  const btn           = document.getElementById('autofillBtn');
  const evalBtn       = document.getElementById('evaluateBtn');
  const saveJobBtn    = document.getElementById('saveJobBtn');
  const evalResult    = document.getElementById('evalResult');
  const errorEl       = document.getElementById('errorMsg');
  const logoutBtn     = document.getElementById('logoutBtn');
  const loginBtn      = document.getElementById('loginBtn');
  const loginEmail    = document.getElementById('loginEmail');
  const loginPassword = document.getElementById('loginPassword');
  const loginError    = document.getElementById('loginError');
  const googleLoginBtn = document.getElementById('googleLoginBtn');
  const debugToggleBtn = document.getElementById('debugToggleBtn');
  const debugLogs     = document.getElementById('debugLogs');
  const clearLogsBtn  = document.getElementById('clearLogsBtn');
  const resumeUpload  = document.getElementById('resumeUpload');
  const resumeStatus  = document.getElementById('resumeStatus');
  const resumeNameSpan = document.getElementById('resumeName');
  const autoEvalToggle = document.getElementById('autoEvalToggle');

  function showLogin() {
    loginSection.style.display = 'block';
    mainSection.style.display = 'none';
  }

  function showMain() {
    loginSection.style.display = 'none';
    mainSection.style.display = 'block';
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    if (!email || !password) {
      loginError.textContent = 'Enter your email and password.';
      return;
    }
    loginBtn.textContent = 'Signing in...';
    loginBtn.disabled = true;
    loginError.textContent = '';

    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      authToken = data.token;
      chrome.storage.local.set({ authToken }, () => {
        logDebug('Token saved to storage');
      });

      await loadProfile();
    } catch (err) {
      loginError.textContent = err.message;
    }

    loginBtn.textContent = 'Sign in';
    loginBtn.disabled = false;
  });

  // ── Login with Google ─────────────────────────────────────────────────────
  // Extensions can't run the passport redirect flow inline in a popup, so we
  // open the existing backend /auth/google route in a normal tab. The same
  // backend flow used by the frontend runs there (Google consent ->
  // callback -> sets the `token` cookie -> redirects to the frontend). We
  // watch for that cookie to appear on BACKEND_URL, then pick it up here.

  googleLoginBtn.addEventListener('click', async () => {
    loginError.textContent = '';
    let opTabId = null;
    let settled = false;
    let listenersAttached = false;
    let timeoutId = null;

    const cleanup = () => {
      if (listenersAttached) {
        chrome.cookies.onChanged.removeListener(onCookieChanged);
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
        listenersAttached = false;
      }
      if (timeoutId !== null) clearTimeout(timeoutId);
      googleLoginBtn.disabled = false;
    };

    const finish = async (token) => {
      if (settled) return;
      settled = true;
      authToken = token;
      chrome.storage.local.set({ authToken }, () => {
        logDebug('Google login: token saved to storage');
      });
      cleanup();
      if (opTabId !== null) {
        chrome.tabs.remove(opTabId).catch(() => {});
      }
      await loadProfile();
    };

    function onCookieChanged(changeInfo) {
      const { cookie, removed } = changeInfo;
      if (removed || cookie.name !== 'token') return;
      if (!BACKEND_URL.includes(cookie.domain.replace(/^\./, ''))) return;
      logDebug('Google login: token cookie detected');
      finish(cookie.value);
    }

    function onTabRemoved(tabId) {
      if (tabId !== opTabId || settled) return;
      // Tab was closed without completing login.
      settled = true;
      cleanup();
      loginError.textContent = 'Google sign-in was cancelled.';
    }

    try {
      googleLoginBtn.disabled = true;

      chrome.cookies.onChanged.addListener(onCookieChanged);
      chrome.tabs.onRemoved.addListener(onTabRemoved);
      listenersAttached = true;

      timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        loginError.textContent = 'Timed out. Please try again.';
      }, 120000);

      const tab = await chrome.tabs.create({ url: `${BACKEND_URL}/auth/google` });
      opTabId = tab.id;
    } catch (err) {
      settled = true;
      cleanup();
      loginError.textContent = 'Could not open the Google sign-in window: ' + err.message;
    }
  });

  logoutBtn.addEventListener('click', () => {
    authToken = null;
    chrome.storage.local.remove('authToken');
    candidateProfile = null;
    showLogin();
  });

  // ── Load profile ───────────────────────────────────────────────────────────

  async function loadProfile() {
    statusEl.textContent = 'Loading profile...';
    errorEl.textContent = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        logDebug('Fetch aborted: timeout after 15s');
      }, 15000);

      const res = await authFetch(`${BACKEND_URL}/api/profile`, { signal: controller.signal });
      clearTimeout(timeoutId);

      logDebug(`Profile fetch status: ${res.status}`);

      if (res.status === 401) {
        authToken = null;
        chrome.storage.local.remove('authToken');
        showLogin();
        loginError.textContent = 'Session expired. Please sign in again.';
        return;
      }

      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

      candidateProfile = await res.json();
      const name = candidateProfile?.user?.name || candidateProfile?.user?.email || 'User';
      statusEl.textContent = `Profile: ${name}`;
      btn.disabled = false;
      showMain();
    } catch (err) {
      logDebug(`Profile fetch error: ${err.message}`);
      statusEl.textContent = 'Error connecting to Vega.';
      if (err.name === 'AbortError') {
        errorEl.textContent = 'Timeout. The backend may be starting up (Render). Try again in 30s.';
      } else {
        errorEl.textContent = err.message;
      }
    }
  }

  // ── Autofill shortcut hint ────────────────────────────────────────────────
  // Show the *actual* key binding Chrome assigned (it can differ per-OS, or be
  // empty if it conflicted with another extension), so the hint never lies.
  function renderShortcut(el, shortcut) {
    if (!el) return;
    if (!shortcut) {
      el.innerHTML = '<span style="color:#9ca3af;">unset · set it in chrome://extensions/shortcuts</span>';
      return;
    }
    const parts = shortcut.includes('+') ? shortcut.split('+') : Array.from(shortcut);
    el.innerHTML = parts.map(p => `<kbd>${p.trim()}</kbd>`).join(' + ');
  }
  if (chrome.commands && chrome.commands.getAll) {
    chrome.commands.getAll((cmds) => {
      const shortcutOf = (name) => {
        const c = (cmds || []).find(x => x.name === name);
        return c ? c.shortcut : '';
      };
      const af = shortcutOf('autofill');
      renderShortcut(document.getElementById('autofillShortcutInline'), af);
      renderShortcut(document.getElementById('autofillShortcutRow'), af);
      renderShortcut(document.getElementById('openShortcutRow'), shortcutOf('_execute_action'));
      renderShortcut(document.getElementById('evalShortcutRow'), shortcutOf('evaluate_job'));
    });
  }

  // ── Init: check stored token or read from backend cookie ──────────────────

  chrome.storage.local.get(['authToken', 'resumeFileName', 'autoEvaluate'], async (result) => {
    if (result.resumeFileName) {
      resumeNameSpan.textContent = result.resumeFileName;
      resumeStatus.style.display = 'block';
    }
    if (result.autoEvaluate !== undefined) {
      autoEvalToggle.checked = result.autoEvaluate;
    }

    if (result.authToken) {
      // Already have a stored token
      authToken = result.authToken;
      await loadProfile();
    } else {
      // Try to read the session cookie set by the web app
      await trySessionCookie();
    }
  });

  async function trySessionCookie() {
    // Check both local dev and production backend URLs
    const urls = [BACKEND_URL, 'http://localhost:3001'];
    for (const url of urls) {
      try {
        const cookie = await chrome.cookies.get({ url, name: 'token' });
        if (cookie?.value) {
          authToken = cookie.value;
          chrome.storage.local.set({ authToken: cookie.value });
          logDebug(`Session cookie found at ${url}`);
          await loadProfile();
          return;
        }
      } catch (e) {
        logDebug(`Cookie read failed for ${url}: ${e.message}`);
      }
    }
    // No cookie found — show login form
    showLogin();
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  autoEvalToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ autoEvaluate: e.target.checked });
  });

  resumeUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      chrome.storage.local.set({
        resumeData: evt.target.result,
        resumeFileName: file.name,
        resumeMime: file.type || 'application/pdf'
      }, () => {
        resumeNameSpan.textContent = file.name;
        resumeStatus.style.display = 'block';
        logDebug(`Resume saved: ${file.name}`);
      });
    };
    reader.readAsDataURL(file);
  });

  debugToggleBtn.addEventListener('click', () => {
    const isHidden = debugLogs.style.display === 'none';
    debugLogs.style.display = isHidden ? 'block' : 'none';
    clearLogsBtn.style.display = isHidden ? 'block' : 'none';
    debugToggleBtn.textContent = isHidden ? 'Hide Debug Logs' : 'Show Debug Logs';
  });

  clearLogsBtn.addEventListener('click', () => { debugLogs.value = ''; });

  // ── Live autofill activity ───────────────────────────────────────────────────
  // The content script relays what Autofill is doing — which fields it filled and
  // with what, when it detects/saves a brand-new field, and when an answer the
  // user edits is synced to the DB/profile. Surface it in the Debug Logs panel.
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== 'vegaLog') return;
    logDebug(msg.message);
    // Auto-reveal the panel so the activity is visible without toggling.
    if (debugLogs.style.display !== 'block') {
      debugLogs.style.display = 'block';
      clearLogsBtn.style.display = 'block';
      debugToggleBtn.textContent = 'Hide Debug Logs';
    }
  });

  // ── Autofill ───────────────────────────────────────────────────────────────

  function showApplyResult(r) {
    if (!r) return;
    evalResult.style.display = 'block';
    const styleFor = (bg, color, border) =>
      `display:block;background:${bg};color:${color};border:1px solid ${border};padding:8px;border-radius:6px;font-size:13px;margin-top:8px;`;
    if (r.error) {
      evalResult.style.cssText = styleFor('#fffbeb', '#92400e', '#fcd34d');
      evalResult.textContent = `⚠️ Autofilled, but couldn't record as applied: ${r.error}`;
      logDebug('Apply-save skipped: ' + r.error);
    } else if (r.alreadyApplied) {
      evalResult.style.cssText = styleFor('#fef2f2', '#991b1b', '#fecaca');
      evalResult.textContent = `🚨 Already applied: ${r.jobTitle} at ${r.companyName}`;
      logDebug(`Already applied: ${r.jobTitle} at ${r.companyName}`);
    } else {
      evalResult.style.cssText = styleFor('#ecfdf5', '#065f46', '#a7f3d0');
      evalResult.textContent = `✅ ${r.updated ? 'Marked applied' : 'Saved as applied'}: ${r.jobTitle} at ${r.companyName}`;
      logDebug(`Recorded as applied: ${r.jobTitle} at ${r.companyName}`);
    }
  }

  btn.addEventListener('click', async () => {
    if (!candidateProfile) return;
    btn.textContent = 'Filling...';
    btn.disabled = true;
    errorEl.textContent = '';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Record this position as Applied in parallel with filling the form so the
      // "already applied" alert fires on future visits. Best-effort — a save
      // failure must never block the autofill itself.
      const savePromise = saveCurrentTabAsApplied(tab).catch(err => ({ error: err.message }));

      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content/autofill.js'] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (profile) => { if (window.runVegaAutofill) window.runVegaAutofill(profile); },
        args: [candidateProfile]
      });
      btn.textContent = 'Done!';

      const saveResult = await savePromise;
      showApplyResult(saveResult);
      showApplyToastInTab(tab.id, saveResult);
    } catch (err) {
      logDebug(`Autofill error: ${err.message}`);
      errorEl.textContent = 'Error: ' + err.message;
      btn.textContent = 'Autofill Form';
      btn.disabled = false;
    }
  });

  // ── Evaluate ───────────────────────────────────────────────────────────────

  evalBtn.addEventListener('click', async () => {
    evalBtn.textContent = 'Evaluating...';
    evalBtn.disabled = true;
    evalResult.style.display = 'none';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error('Could not get current tab URL');

      const res = await authFetch(`${BACKEND_URL}/api/browser-extension/evaluate-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url })
      });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();

      evalResult.style.display = 'block';
      if (data.applied) {
        evalResult.style.cssText = 'display:block;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:8px;border-radius:6px;font-size:13px;margin-top:8px;';
        evalResult.textContent = `🚨 ${data.message} (Status: ${data.status})`;
      } else {
        evalResult.style.cssText = 'display:block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:8px;border-radius:6px;font-size:13px;margin-top:8px;';
        evalResult.textContent = `✨ ${data.message}`;
      }
    } catch (err) {
      logDebug(`Eval error: ${err.message}`);
      errorEl.textContent = 'Eval Error: ' + err.message;
    }
    evalBtn.textContent = 'Evaluate Job';
    evalBtn.disabled = false;
  });

  // ── Save as Applied ────────────────────────────────────────────────────────

  saveJobBtn.addEventListener('click', async () => {
    saveJobBtn.textContent = 'Saving...';
    saveJobBtn.disabled = true;
    errorEl.textContent = '';
    evalResult.style.display = 'none';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error('Could not get current tab URL');
      const saveResult = await saveCurrentTabAsApplied(tab);
      showApplyResult(saveResult);
      showApplyToastInTab(tab.id, saveResult);
    } catch (err) {
      logDebug(`Save Job error: ${err.message}`);
      errorEl.textContent = 'Save Error: ' + err.message;
    }
    saveJobBtn.textContent = 'Save as Applied';
    saveJobBtn.disabled = false;
  });
});
