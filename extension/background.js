chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'autofill') {
    console.log("Triggering autofill via keyboard shortcut");
    try {
      const res = await fetch('https://vega-jobs.onrender.com/api/profile');
      if (!res.ok) throw new Error("Failed to fetch profile");
      const profile = await res.json();
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      // Inject the autofill script file
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/autofill.js']
      });

      // Pass the fetched profile to the script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (p) => {
          if (window.runVegaAutofill) {
            window.runVegaAutofill(p);
          }
        },
        args: [profile]
      });
    } catch (err) {
      console.error("Autofill shortcut error:", err);
    }
  } else if (command === 'evaluate_job') {
    console.log("Triggering evaluate_job via keyboard shortcut");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      const res = await fetch(`https://vega-jobs.onrender.com/api/browser-extension/evaluate-job?url=${encodeURIComponent(tab.url)}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      
      const alertMsg = data.applied ? `🚨 ${data.message} (Status: ${data.status})` : `✨ ${data.message}`;
      
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
    const res = await fetch(`https://vega-jobs.onrender.com/api/browser-extension/evaluate-job?url=${encodeURIComponent(url)}`);
    if (!res.ok) return;
    const data = await res.json();
    
    // Set Badge Color based on status
    if (data.applied) {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#DC2626' }); // Red
      chrome.action.setBadgeText({ tabId, text: 'OLD' });
    } else {
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#059669' }); // Green
      chrome.action.setBadgeText({ tabId, text: 'NEW' });
    }

    // Inject floating toast into the webpage
    const toastMsg = data.applied ? `🚨 ${data.message} (Status: ${data.status})` : `✨ ${data.message}`;
    const bgColor = data.applied ? '#fef2f2' : '#ecfdf5';
    const textColor = data.applied ? '#991b1b' : '#065f46';
    const borderColor = data.applied ? '#fecaca' : '#a7f3d0';

    await chrome.scripting.executeScript({
      target: { tabId },
      func: (msg, bg, text, border) => {
        // Remove existing toast if any
        const existing = document.getElementById('vega-eval-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'vega-eval-toast';
        toast.textContent = msg;
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 2147483647;
          background-color: ${bg};
          color: ${text};
          border: 1px solid ${border};
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          font-weight: 500;
          pointer-events: none;
          transition: opacity 0.5s ease-in-out;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 500);
        }, 3000);
      },
      args: [toastMsg, bgColor, textColor, borderColor]
    });
  } catch (err) {
    console.error("Auto-eval background error:", err);
  }
}

// Listen for tab updates (e.g. navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.storage.local.get(['autoEvaluate'], (result) => {
      if (result.autoEvaluate) {
        evaluateJob(tabId, tab.url);
      }
    });
  }
});
