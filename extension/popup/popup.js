let candidateProfile = null;

// Debug logging helper
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
  if (errorEl) {
    errorEl.textContent = `JS Error: ${message} at line ${lineno}`;
  }
  return false;
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const statusEl = document.getElementById('status');
    const btn = document.getElementById('autofillBtn');
    const evalBtn = document.getElementById('evaluateBtn');
    const evalResult = document.getElementById('evalResult');
    const errorEl = document.getElementById('errorMsg');
  const debugToggleBtn = document.getElementById('debugToggleBtn');
  const debugLogs = document.getElementById('debugLogs');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  const resumeUpload = document.getElementById('resumeUpload');
  const resumeStatus = document.getElementById('resumeStatus');
  const resumeNameSpan = document.getElementById('resumeName');

  // Load saved resume state
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['resumeFileName'], (result) => {
      if (result.resumeFileName) {
        resumeNameSpan.textContent = result.resumeFileName;
        resumeStatus.style.display = 'block';
        logDebug(`Loaded saved resume info: ${result.resumeFileName}`);
      }
    });

    resumeUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      logDebug(`Reading file: ${file.name} (${file.size} bytes)`);
      const reader = new FileReader();
      reader.onload = function(evt) {
        const base64Data = evt.target.result;
        chrome.storage.local.set({ 
          resumeData: base64Data,
          resumeFileName: file.name,
          resumeMime: file.type || 'application/pdf'
        }, () => {
          logDebug(`Saved ${file.name} to local storage!`);
          resumeNameSpan.textContent = file.name;
          resumeStatus.style.display = 'block';
        });
      };
      reader.readAsDataURL(file);
    });
  } else {
    logDebug("Warning: chrome.storage is undefined. You may need to remove and re-add the extension for new permissions to take effect.");
  }

  debugToggleBtn.addEventListener('click', () => {
    if (debugLogs.style.display === 'none') {
      debugLogs.style.display = 'block';
      clearLogsBtn.style.display = 'block';
      debugToggleBtn.textContent = 'Hide Debug Logs';
    } else {
      debugLogs.style.display = 'none';
      clearLogsBtn.style.display = 'none';
      debugToggleBtn.textContent = 'Show Debug Logs';
    }
  });

  clearLogsBtn.addEventListener('click', () => {
    debugLogs.value = '';
  });

  try {
    logDebug("Starting fetch to Render backend...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      logDebug("Fetch aborted: timeout after 15s (Render might be waking up)");
    }, 15000);

    const res = await fetch('https://vega-jobs.onrender.com/api/profile', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    logDebug(`Fetch complete. Status: ${res.status}`);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    
    candidateProfile = await res.json();
    logDebug(`Profile JSON parsed. Name: ${candidateProfile?.user?.name}`);
    
    if (candidateProfile) {
      const name = candidateProfile.user?.name;
      if (!name) {
        logDebug("WARNING: No name found in profile! The production backend may be running an old version or missing data.");
        errorEl.textContent = "Warning: Profile has no name/email. Are you sure the backend changes are deployed to Render?";
      }
      statusEl.textContent = `Profile loaded: ${name || 'Candidate (Missing Name)'}`;
      btn.disabled = false;
    } else {
      statusEl.textContent = 'No profile found in Vega.';
      logDebug("No profile object returned from backend.");
    }
  } catch (err) {
    logDebug(`Fetch error: ${err.message}`);
    console.error('Fetch error:', err);
    statusEl.textContent = 'Failed to connect to Vega backend.';
    if (err.name === 'AbortError') {
      errorEl.textContent = "Request timed out. The free Render backend might be waking up. Try opening the popup again in 30 seconds.";
    } else {
      errorEl.textContent = err.message + " (Is the Render backend running?)";
    }
  }

  btn.addEventListener('click', async () => {
    if (!candidateProfile) return;
    
    btn.textContent = 'Filling...';
    btn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/autofill.js']
      });

      logDebug(`Injected autofill.js successfully. Passing profile...`);

      // Pass the data to the injected script by executing a small function that calls a global method defined in autofill.js
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (profile) => {
          if (window.runVegaAutofill) {
            window.runVegaAutofill(profile);
          }
        },
        args: [candidateProfile]
      });

      logDebug(`Autofill script executed!`);
      btn.textContent = 'Done!';
      // Removed the auto-close window.close() so you can inspect logs
    } catch (err) {
      logDebug(`Autofill execute error: ${err.message}`);
      console.error(err);
      errorEl.textContent = 'Error: ' + err.message;
      btn.textContent = 'Autofill Form';
      btn.disabled = false;
    }
  });

  evalBtn.addEventListener('click', async () => {
    evalBtn.textContent = 'Evaluating...';
    evalBtn.disabled = true;
    evalResult.style.display = 'none';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) throw new Error("Could not get current tab URL");

      logDebug(`Evaluating URL: ${tab.url}`);
      const res = await fetch(`https://vega-jobs.onrender.com/api/browser-extension/evaluate-job?url=${encodeURIComponent(tab.url)}`);
      
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      
      evalResult.style.display = 'block';
      if (data.applied) {
        evalResult.style.backgroundColor = '#fef2f2'; // light red
        evalResult.style.color = '#991b1b';
        evalResult.style.border = '1px solid #fecaca';
        evalResult.textContent = `🚨 ${data.message} (Status: ${data.status})`;
      } else {
        evalResult.style.backgroundColor = '#ecfdf5'; // light green
        evalResult.style.color = '#065f46';
        evalResult.style.border = '1px solid #a7f3d0';
        evalResult.textContent = `✨ ${data.message}`;
      }
    } catch (err) {
      logDebug(`Eval error: ${err.message}`);
      console.error(err);
      errorEl.textContent = 'Eval Error: ' + err.message;
    }

    evalBtn.textContent = 'Evaluate Job';
    evalBtn.disabled = false;
  });

  } catch (globalErr) {
    const errorEl = document.getElementById('errorMsg');
    if (errorEl) {
      errorEl.textContent = `Init Error: ${globalErr.message}`;
    }
    console.error("Initialization Error:", globalErr);
  }
});
