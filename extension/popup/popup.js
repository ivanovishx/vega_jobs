const BACKEND_URL = 'https://vega-jobs.onrender.com';

let candidateProfile = null;
let authToken = null;

// Authenticated fetch — always sends Bearer token
async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...options, headers });
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
      loginError.textContent = 'Ingresa tu correo y contraseña.';
      return;
    }
    loginBtn.textContent = 'Ingresando...';
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

    loginBtn.textContent = 'Iniciar sesión';
    loginBtn.disabled = false;
  });

  logoutBtn.addEventListener('click', () => {
    authToken = null;
    chrome.storage.local.remove('authToken');
    candidateProfile = null;
    showLogin();
  });

  // ── Load profile ───────────────────────────────────────────────────────────

  async function loadProfile() {
    statusEl.textContent = 'Cargando perfil...';
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
        loginError.textContent = 'Sesión expirada. Inicia sesión de nuevo.';
        return;
      }

      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);

      candidateProfile = await res.json();
      const name = candidateProfile?.user?.name || candidateProfile?.user?.email || 'Usuario';
      statusEl.textContent = `Perfil: ${name}`;
      btn.disabled = false;
      showMain();
    } catch (err) {
      logDebug(`Profile fetch error: ${err.message}`);
      statusEl.textContent = 'Error al conectar con Vega.';
      if (err.name === 'AbortError') {
        errorEl.textContent = 'Timeout. El backend puede estar iniciando (Render). Intenta en 30s.';
      } else {
        errorEl.textContent = err.message;
      }
    }
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

  // ── Autofill ───────────────────────────────────────────────────────────────

  btn.addEventListener('click', async () => {
    if (!candidateProfile) return;
    btn.textContent = 'Filling...';
    btn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content/autofill.js'] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (profile) => { if (window.runVegaAutofill) window.runVegaAutofill(profile); },
        args: [candidateProfile]
      });
      btn.textContent = 'Done!';
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
    saveJobBtn.textContent = 'Scraping...';
    saveJobBtn.disabled = true;
    errorEl.textContent = '';
    evalResult.style.display = 'none';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) throw new Error('Could not get current tab URL');

      const formData = new FormData();
      formData.append('url', tab.url);
      const parseRes = await authFetch(`${BACKEND_URL}/api/applications/autofill`, {
        method: 'POST',
        body: formData
      });
      if (!parseRes.ok) throw new Error(`Parse error: ${parseRes.status}`);
      const parsedData = await parseRes.json();

      if (!parsedData.companyName || !parsedData.jobTitle) {
        throw new Error('Could not extract company or job title from page.');
      }

      logDebug(`Extracted: ${parsedData.jobTitle} at ${parsedData.companyName}`);
      saveJobBtn.textContent = 'Saving...';

      const saveRes = await authFetch(`${BACKEND_URL}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: parsedData.companyName,
          jobTitle: parsedData.jobTitle,
          jobUrl: tab.url,
          status: 'Applied',
          dateApplied: new Date().toISOString()
        })
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        throw new Error(errorData.error || `Save error: ${saveRes.status}`);
      }

      evalResult.style.cssText = 'display:block;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:8px;border-radius:6px;font-size:13px;margin-top:8px;';
      evalResult.textContent = `✅ Saved ${parsedData.jobTitle} at ${parsedData.companyName}!`;
      logDebug('Application saved successfully.');
    } catch (err) {
      logDebug(`Save Job error: ${err.message}`);
      errorEl.textContent = 'Save Error: ' + err.message;
    }
    saveJobBtn.textContent = 'Save as Applied';
    saveJobBtn.disabled = false;
  });
});
