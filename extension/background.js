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
