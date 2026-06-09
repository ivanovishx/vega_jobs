window.runVegaAutofill = function(profile) {
  console.log("Vega Autofill started with profile:", profile);

  const nameParts = (profile.user?.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  
  let formattedPhone = profile.phone || "";
  if (formattedPhone && !formattedPhone.startsWith("+") && !formattedPhone.startsWith("1")) {
    formattedPhone = "+1 " + formattedPhone;
  } else if (formattedPhone && formattedPhone.startsWith("1")) {
    formattedPhone = "+" + formattedPhone;
  }

  const fieldMapping = {
    first_name: [firstName],
    last_name: [lastName],
    name: [profile.user?.name],
    email: [profile.user?.email],
    phone: [formattedPhone],
    linkedin: [profile.linkedInUrl],
    github: [profile.githubUrl],
    portfolio: [profile.portfolioUrl],
    website: [profile.portfolioUrl]
  };

  // Keyword order matters: more specific keys first, generic 'name' last.
  const keywords = {
    first_name: ['first_name', 'firstname', 'first-name', 'fname', 'first name'],
    last_name: ['last_name', 'lastname', 'last-name', 'lname', 'last name'],
    email: ['email', 'e-mail'],
    phone: ['phone', 'tel', 'mobile'],
    linkedin: ['linkedin', 'linked-in', 'linked in'],
    github: ['github', 'git hub'],
    portfolio: ['portfolio', 'website', 'personal site', 'url'],
    name: ['name', 'full_name', 'fullname', 'full name']
  };

  // Collect label/aria text associated with an input (Greenhouse uses generic
  // ids like question_12345, so the field name only exists in the <label>).
  const getLabelText = (el) => {
    let text = '';
    try {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) text += ' ' + lbl.textContent;
      }
      const wrap = el.closest('label');
      if (wrap) text += ' ' + wrap.textContent;
      const aria = el.getAttribute('aria-label');
      if (aria) text += ' ' + aria;
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        labelledBy.split(/\s+/).forEach(refId => {
          const ref = document.getElementById(refId);
          if (ref) text += ' ' + ref.textContent;
        });
      }
    } catch (e) { /* ignore */ }
    return text.toLowerCase();
  };

  // React-controlled inputs (Greenhouse) ignore plain .value assignment;
  // use the native setter so the framework registers the change.
  const setNativeValue = (input, value) => {
    const proto = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value');
    if (setter && setter.set) {
      setter.set.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  let filledCount = 0;

  // 1. Fill Text Inputs
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type])');
  inputs.forEach(input => {
    const nameAtt = (input.getAttribute('name') || '').toLowerCase();
    const idAtt = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const labelText = getLabelText(input);
    const textToMatch = `${nameAtt} ${idAtt} ${placeholder} ${labelText}`;

    for (const [fieldKey, fieldKeywords] of Object.entries(keywords)) {
      if (fieldKeywords.some(kw => textToMatch.includes(kw))) {
        const values = fieldMapping[fieldKey];
        const valToSet = values && values[0];
        if (valToSet && !input.value) {
          setNativeValue(input, valToSet);
          filledCount++;
          input.style.backgroundColor = '#e0e7ff';
        }
        break; // stop at first keyword match even if no value, to avoid wrong fills
      }
    }
  });

  // 2. Select Country Dropdowns (set to US)
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    const nameAtt = (select.getAttribute('name') || '').toLowerCase();
    const idAtt = (select.getAttribute('id') || '').toLowerCase();
    
    // Country logic
    if (nameAtt.includes('country') || idAtt.includes('country') || nameAtt.includes('location')) {
      for (const option of select.options) {
        const text = option.text.toLowerCase();
        if (text === 'united states' || text === 'us' || text === 'united states of america') {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            select.style.backgroundColor = '#e0e7ff';
          }
          break;
        }
      }
    }

    // Demographics logic
    const selectLabelMatch = `${nameAtt} ${idAtt}`;
    
    // Helper to find and set best option
    const matchAndSetOption = (targetValue) => {
      if (!targetValue) return;
      const targetText = targetValue.toLowerCase();
      let bestOption = null;
      
      for (const option of select.options) {
        const optionText = option.text.toLowerCase();
        if (optionText.includes(targetText) || targetText.includes(optionText)) {
          bestOption = option;
          break;
        }
      }
      
      if (bestOption && select.value !== bestOption.value) {
        select.value = bestOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
        select.style.backgroundColor = '#e0e7ff';
      }
    };

    if (selectLabelMatch.includes('gender') || selectLabelMatch.includes('sex')) {
      matchAndSetOption(profile.gender);
    } else if (selectLabelMatch.includes('race') || selectLabelMatch.includes('ethnic')) {
      matchAndSetOption(profile.race);
    } else if (selectLabelMatch.includes('veteran')) {
      matchAndSetOption(profile.veteranStatus);
    } else if (selectLabelMatch.includes('disability') || selectLabelMatch.includes('handicap')) {
      matchAndSetOption(profile.disabilityStatus);
    }
  });

  // 3. Inject Resume
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['resumeData', 'resumeFileName', 'resumeMime'], (result) => {
      if (result.resumeData && result.resumeFileName) {
        // Convert Base64 back to File
        const arr = result.resumeData.split(',');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        const file = new File([u8arr], result.resumeFileName, {type: result.resumeMime || 'application/pdf'});
        
        // Find file inputs that might be for resume
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(fileInput => {
          const nameAtt = (fileInput.getAttribute('name') || '').toLowerCase();
          const idAtt = (fileInput.getAttribute('id') || '').toLowerCase();
          if (nameAtt.includes('resume') || idAtt.includes('resume') || nameAtt.includes('cv') || idAtt.includes('cv')) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            console.log(`Injected resume into ${idAtt || nameAtt}`);
          }
        });
      }
    });
  }

  console.log(`Vega Autofill complete. Filled ${filledCount} fields.`);
};
