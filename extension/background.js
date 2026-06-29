const BACKEND_URL = 'https://vega-jobs.onrender.com';

// Resolves the auth token: storage first, then fallback to backend cookie
async function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], async (result) => {
      if (result.authToken) { resolve(result.authToken); return; }

      // Fallback: read session cookie set by the web app
      for (const url of [BACKEND_URL, 'http://localhost:3001']) {
        try {
          const cookie = await chrome.cookies.get({ url, name: 'token' });
          if (cookie?.value) {
            chrome.storage.local.set({ authToken: cookie.value });
            resolve(cookie.value);
            return;
          }
        } catch (e) {}
      }
      resolve(null);
    });
  });
}

// Authenticated fetch — always sends Bearer token
async function authFetch(url, options = {}) {
  const token = await getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// ── Record-as-applied (shared by popup button + keyboard shortcut) ───────────
function titleCase(s) {
  return (s || '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

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
async function saveTabAsApplied(tab) {
  if (!tab || !tab.url) return { error: 'No active tab URL' };

  let companyName = '', jobTitle = '', location = '', salaryRange = '';
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
    console.warn('saveTabAsApplied: server scrape failed —', e.message);
  }

  const fromTitle = deriveFromTitle(tab.title);
  const fromUrl = inferCompanyFromUrl(tab.url);
  if (!jobTitle || /unknown/i.test(jobTitle)) jobTitle = fromTitle.jobTitle || jobTitle;
  if (!companyName || /unknown/i.test(companyName)) companyName = fromUrl || fromTitle.companyName || companyName;
  const norm = (s) => (s || '').trim().toLowerCase();
  if (companyName && norm(jobTitle) === norm(companyName) && fromTitle.companyName && norm(fromTitle.companyName) !== norm(companyName)) {
    jobTitle = fromTitle.companyName;
  }
  if (!jobTitle) jobTitle = 'Application';
  if (!companyName) return { error: 'Could not determine the company for this page.' };

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
    if ((data.error || '').toLowerCase().includes('already')) {
      return { alreadyApplied: true, jobTitle, companyName };
    }
    return { error: data.error || `Save error: ${saveRes.status}` };
  }
  return { saved: !data.updated, updated: !!data.updated, jobTitle, companyName };
}

// Inject an on-page toast (top frame) confirming the record-as-applied outcome.
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

// ── Custom field learning ────────────────────────────────────────────────────
// The content script can't talk to the authenticated backend directly, so it
// relays discovered fields and user edits through these messages.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === 'vegaDiscoverFields') {
    (async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/profile/custom-fields/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: msg.fields || [] })
        });
        if (!res.ok) {
          let body = '';
          try { body = (await res.text()).slice(0, 200); } catch (e) {}
          throw new Error(`HTTP ${res.status}${body ? ' — ' + body : ''}`);
        }
        const data = await res.json();
        // Backend may return either a bare array (older deploy) or
        // { fields, createdKeys } (current). Normalize to both.
        const fields = Array.isArray(data) ? data : (data.fields || []);
        const createdKeys = Array.isArray(data) ? [] : (data.createdKeys || []);
        sendResponse({ ok: true, fields, createdKeys });
      } catch (err) {
        console.error('vegaDiscoverFields error:', err);
        sendResponse({ ok: false, error: err.message, fields: [], createdKeys: [] });
      }
    })();
    return true; // keep the message channel open for the async response
  }

  if (msg.type === 'vegaSaveFieldValue') {
    (async () => {
      try {
        const res = await authFetch(`${BACKEND_URL}/api/profile/custom-fields/value`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.field || {})
        });
        if (!res.ok) {
          let body = '';
          try { body = (await res.text()).slice(0, 200); } catch (e) {}
          throw new Error(`HTTP ${res.status}${body ? ' — ' + body : ''}`);
        }
        const data = await res.json();
        // Current backend returns { field, created, firstAnswer }; older deploys
        // returned the bare field object.
        const saved = data && data.field ? data.field : data;
        const firstAnswer = !!(data && data.firstAnswer);
        const created = !!(data && data.created);
        sendResponse({ ok: true, saved, firstAnswer, created });
      } catch (err) {
        console.error('vegaSaveFieldValue error:', err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'autofill') {
    console.log("Triggering autofill via keyboard shortcut");
    try {
      const res = await authFetch(`${BACKEND_URL}/api/profile`);
      if (!res.ok) throw new Error("Failed to fetch profile");
      const profile = await res.json();

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      // Filling a form means you're applying — record it so the "already
      // applied" alert fires next time. Best-effort; never blocks autofill.
      const savePromise = saveTabAsApplied(tab).catch(err => ({ error: err.message }));

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content/autofill.js']
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (p) => { if (window.runVegaAutofill) window.runVegaAutofill(p); },
        args: [profile]
      });

      const saveResult = await savePromise;
      showApplyToastInTab(tab.id, saveResult);
      if (saveResult && !saveResult.error) {
        console.log('Autofill shortcut: recorded as applied —', saveResult);
      } else if (saveResult && saveResult.error) {
        console.warn('Autofill shortcut: could not record as applied —', saveResult.error);
      }
    } catch (err) {
      console.error("Autofill shortcut error:", err);
    }
  } else if (command === 'evaluate_job') {
    console.log("Triggering evaluate_job via keyboard shortcut");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      let pageText = '';
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body.innerText
        });
        if (results && results[0]) pageText = results[0].result;
      } catch (e) {
        console.warn(e);
      }

      const res = await authFetch(`${BACKEND_URL}/api/browser-extension/evaluate-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: tab.url, text: pageText })
      });
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();

      let alertMsg;
      if (data.applied) alertMsg = `🚨 ${data.message} (Status: ${data.status})`;
      else if (data.inToApply) alertMsg = `📌 ${data.message}`;
      else alertMsg = `✨ ${data.message}`;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (msg) => alert(msg),
        args: [alertMsg]
      });
    } catch (err) {
      console.error("Eval shortcut error:", err);
    }
  }
});

// Helper to evaluate a job silently
async function evaluateJob(tabId, url) {
  try {
    let pageText = '';
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.body.innerText
      });
      if (results && results[0]) pageText = results[0].result;
    } catch (e) {
      console.warn("Could not extract page text:", e);
    }

    const res = await authFetch(`${BACKEND_URL}/api/browser-extension/evaluate-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, text: pageText })
    });
    if (!res.ok) return;
    const data = await res.json();

    if (data.ignore) {
      chrome.action.setBadgeText({ tabId, text: '' });
      return;
    }

    let toastPrefix = '';
    let bgColor, textColor, borderColor;

    if (data.applied) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' });
      chrome.action.setBadgeText({ tabId, text: 'OLD' });
      toastPrefix = `🚨 ${data.message} (Status: ${data.status})`;
      bgColor = '#fef2f2'; textColor = '#991b1b'; borderColor = '#fecaca';
    } else if (data.inToApply) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#D97706' });
      chrome.action.setBadgeText({ tabId, text: 'APPLY' });
      toastPrefix = `📌 ${data.message}`;
      bgColor = '#fffbeb'; textColor = '#92400e'; borderColor = '#fcd34d';
    } else {
      const category = data.category || 'Company';
      const normalizedUrl = data.normalizedUrl || url;
      const inferredCompany = data.inferredCompany || 'Unknown Company';

      if (category === 'Job') {
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#059669' });
        chrome.action.setBadgeText({ tabId, text: 'JOB' });
        bgColor = '#ecfdf5'; textColor = '#065f46'; borderColor = '#a7f3d0';

        let saved = false;
        try {
          const formData = new FormData();
          formData.append('url', url);
          const scrapeRes = await authFetch(`${BACKEND_URL}/api/applications/autofill`, {
            method: 'POST',
            body: formData
          });

          if (scrapeRes.ok) {
            const parsed = await scrapeRes.json();
            if (parsed.companyName && parsed.jobTitle && parsed.jobTitle !== 'Unknown Title') {
              await authFetch(`${BACKEND_URL}/api/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  companyName: parsed.companyName,
                  jobTitle: parsed.jobTitle,
                  jobUrl: normalizedUrl,
                  location: parsed.location,
                  salaryRange: parsed.salaryRange,
                  notes: parsed.notes,
                  status: 'To Apply',
                  category: 'Job',
                  dateApplied: new Date().toISOString()
                })
              });
              saved = true;
              data.message = `✨ New Job saved: ${parsed.companyName} — ${parsed.jobTitle}`;
            }
          }
        } catch (scrapeErr) {
          console.error("Failed to auto-scrape new position:", scrapeErr);
        }
        if (!saved) data.message = "✨ New Job detected (scrape failed, not saved).";
        toastPrefix = data.message;
      } else if (category === 'Careers') {
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563EB' });
        chrome.action.setBadgeText({ tabId, text: 'CAR' });
        bgColor = '#eff6ff'; textColor = '#1e40af'; borderColor = '#bfdbfe';

        try {
          await authFetch(`${BACKEND_URL}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: inferredCompany,
              jobTitle: 'Careers Page',
              jobUrl: normalizedUrl,
              status: 'To Apply',
              category: 'Careers',
              dateApplied: new Date().toISOString()
            })
          });
        } catch (e) { console.error("Failed to save Careers entry:", e); }
        toastPrefix = `📋 Careers page tracked: ${inferredCompany}`;
      } else {
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#6B7280' });
        chrome.action.setBadgeText({ tabId, text: 'CO' });
        bgColor = '#f9fafb'; textColor = '#374151'; borderColor = '#e5e7eb';

        try {
          await authFetch(`${BACKEND_URL}/api/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyName: inferredCompany,
              jobTitle: 'Company Page',
              jobUrl: normalizedUrl,
              status: 'To Apply',
              category: 'Company',
              dateApplied: new Date().toISOString()
            })
          });
        } catch (e) { console.error("Failed to save Company entry:", e); }
        toastPrefix = `🏢 Company tracked: ${inferredCompany}`;
      }
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, bg, text, border) => {
        const existing = document.getElementById('vega-eval-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'vega-eval-toast';
        toast.textContent = msg;
        toast.style.cssText = `
          position: fixed; top: 20px; right: 20px; z-index: 2147483647;
          background-color: ${bg}; color: ${text}; border: 1px solid ${border};
          padding: 12px 20px; border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
          font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
          font-weight: 500; pointer-events: none; transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 5000);
      },
      args: [toastPrefix, bgColor, textColor, borderColor]
    });
  } catch (err) {
    console.error("Auto-eval background error:", err);
  }
}

function createIconImageData(color) {
  const size = 48;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = color === 'green' ? '#22c55e' : '#6b7280';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', size / 2, size / 2 + 1);
  return ctx.getImageData(0, 0, size, size);
}

function updateExtensionIcon(active) {
  try {
    const imageData = createIconImageData(active ? 'green' : 'gray');
    chrome.action.setIcon({ imageData });
  } catch (e) {
    console.warn('setIcon failed:', e);
  }
}

chrome.storage.local.get(['autoEvaluate'], (result) => {
  updateExtensionIcon(!!result.autoEvaluate);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && 'autoEvaluate' in changes) {
    updateExtensionIcon(!!changes.autoEvaluate.newValue);
  }
});

const inFlightEvals = new Set();
const recentlyEvaluated = new Map();
const RECENT_TTL_MS = 30_000;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url || !tab.url.startsWith('http')) return;

  chrome.storage.local.get(['autoEvaluate', 'authToken'], async (result) => {
    if (!result.autoEvaluate || !result.authToken) return;

    const key = `${tabId}|${tab.url}`;
    if (inFlightEvals.has(key)) return;

    const recent = recentlyEvaluated.get(tabId);
    if (recent && recent.url === tab.url && Date.now() - recent.ts < RECENT_TTL_MS) return;

    inFlightEvals.add(key);
    try {
      await evaluateJob(tabId, tab.url);
      recentlyEvaluated.set(tabId, { url: tab.url, ts: Date.now() });
    } finally {
      inFlightEvals.delete(key);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  recentlyEvaluated.delete(tabId);
});
