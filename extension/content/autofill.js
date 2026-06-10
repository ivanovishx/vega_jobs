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
    first_name: firstName,
    last_name: lastName,
    name: profile.user?.name,
    email: profile.user?.email,
    phone: formattedPhone,
    linkedin: profile.linkedInUrl,
    github: profile.githubUrl,
    portfolio: profile.portfolioUrl,
    website: profile.portfolioUrl
  };

  // Keyword order matters: more specific keys are checked first; the generic
  // 'name' bucket is last so it only catches "Name" / "Full Name" fields.
  const keywords = {
    first_name: ['first_name', 'firstname', 'first-name', 'fname', 'first name', 'given name', 'givenname', 'given_name'],
    last_name:  ['last_name', 'lastname', 'last-name', 'lname', 'last name', 'surname', 'family name', 'familyname', 'family_name'],
    email:      ['email', 'e-mail', 'e_mail', 'emailaddress'],
    phone:      ['phone', 'tel', 'telephone', 'mobile', 'cell', 'phonenumber'],
    linkedin:   ['linkedin', 'linked-in', 'linked_in', 'linked in'],
    github:     ['github', 'git_hub', 'git hub', 'git-hub'],
    portfolio:  ['portfolio', 'website', 'personal site', 'personal-site', 'personalsite', 'personal website', 'web site', 'web_site'],
    name:       ['full_name', 'fullname', 'full name', 'full-name', 'name']
  };

  // SmartRecruiters/Workday/Lever/Greenhouse all stash the semantic name in
  // different places. Collect everything we can find associated with the input
  // so a single keyword pass covers all of them.
  const getFieldText = (el) => {
    const parts = [];
    const push = (s) => { if (s) parts.push(s); };

    push(el.getAttribute('name'));
    push(el.id);
    push(el.getAttribute('placeholder'));
    push(el.getAttribute('aria-label'));
    push(el.getAttribute('data-test'));
    push(el.getAttribute('data-testid'));
    push(el.getAttribute('data-qa'));
    push(el.getAttribute('data-id'));
    push(el.getAttribute('data-field'));
    push(el.getAttribute('autocomplete'));

    try {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) push(lbl.textContent);
      }
      const wrap = el.closest('label');
      if (wrap) push(wrap.textContent);

      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        labelledBy.split(/\s+/).forEach(refId => {
          const ref = document.getElementById(refId);
          if (ref) push(ref.textContent);
        });
      }
      const describedBy = el.getAttribute('aria-describedby');
      if (describedBy) {
        describedBy.split(/\s+/).forEach(refId => {
          const ref = document.getElementById(refId);
          if (ref) push(ref.textContent);
        });
      }
    } catch (e) { /* ignore */ }

    return parts.join(' ').toLowerCase();
  };

  // React/Vue-controlled inputs ignore plain .value assignment; use the native
  // setter so the framework registers the change and re-renders.
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

  const highlight = (el) => { try { el.style.backgroundColor = '#e0e7ff'; } catch (e) {} };

  let filledCount = 0;

  // 1. Fill text-shaped inputs and textareas. Cast a wide net by allow-listing
  // the types we know are safe, then skipping the structural ones explicitly.
  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio', 'file', 'password', 'range', 'color']);
  const candidates = document.querySelectorAll('input, textarea');
  candidates.forEach(input => {
    if (input.tagName === 'INPUT' && SKIP_TYPES.has((input.type || '').toLowerCase())) return;
    if (input.disabled || input.readOnly) return;

    const textToMatch = getFieldText(input);
    if (!textToMatch) return;

    for (const [fieldKey, fieldKeywords] of Object.entries(keywords)) {
      if (fieldKeywords.some(kw => textToMatch.includes(kw))) {
        const valToSet = fieldMapping[fieldKey];
        if (valToSet && !input.value) {
          setNativeValue(input, valToSet);
          filledCount++;
          highlight(input);
        }
        break; // stop at first keyword match to avoid wrong fills
      }
    }
  });

  // 2. Native <select> dropdowns — country defaults to US, demographics from profile.
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    if (select.disabled) return;
    const labelText = getFieldText(select);

    if (labelText.includes('country') || labelText.includes('nationality')) {
      for (const option of select.options) {
        const t = option.text.toLowerCase().trim();
        if (t === 'united states' || t === 'us' || t === 'usa' || t === 'united states of america') {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            highlight(select);
          }
          return;
        }
      }
    }

    const matchAndSetOption = (targetValue) => {
      if (!targetValue) return;
      const target = targetValue.toLowerCase();
      for (const option of select.options) {
        const optText = option.text.toLowerCase();
        if (optText.includes(target) || target.includes(optText)) {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            highlight(select);
          }
          return;
        }
      }
    };

    if (labelText.includes('gender') || labelText.includes('sex ') || labelText.endsWith(' sex')) {
      matchAndSetOption(profile.gender);
    } else if (labelText.includes('race') || labelText.includes('ethnic')) {
      matchAndSetOption(profile.race);
    } else if (labelText.includes('veteran')) {
      matchAndSetOption(profile.veteranStatus);
    } else if (labelText.includes('disability') || labelText.includes('handicap')) {
      matchAndSetOption(profile.disabilityStatus);
    }
  });

  // 3. Resume upload — match by name/id/label/aria as well as `accept` so
  // we catch SmartRecruiters' / Workday's hidden file inputs behind custom
  // drop zones that label the surrounding region rather than the input.
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['resumeData', 'resumeFileName', 'resumeMime'], (result) => {
      if (!result.resumeData || !result.resumeFileName) return;

      const arr = result.resumeData.split(',');
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const file = new File([u8arr], result.resumeFileName, { type: result.resumeMime || 'application/pdf' });

      const RESUME_KEYWORDS = ['resume', 'cv', 'curriculum', 'attach', 'upload your', 'upload file'];
      const fileInputs = document.querySelectorAll('input[type="file"]');
      let injected = 0;
      fileInputs.forEach(fileInput => {
        if (fileInput.disabled) return;
        const accept = (fileInput.getAttribute('accept') || '').toLowerCase();
        // Skip clearly non-document upload slots (e.g. image-only photo upload).
        if (accept && !/(pdf|doc|word|application|\*)/.test(accept)) return;

        const text = getFieldText(fileInput);
        const labelMatch = RESUME_KEYWORDS.some(kw => text.includes(kw));
        // Single file input on the page is overwhelmingly the resume slot.
        const isOnlyFileInput = fileInputs.length === 1;

        if (labelMatch || isOnlyFileInput) {
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            injected++;
            highlight(fileInput.closest('label, div, section') || fileInput);
            console.log(`Injected resume into`, text || fileInput);
          } catch (e) {
            console.warn("Resume injection failed for one input:", e);
          }
        }
      });
      if (injected === 0 && fileInputs.length > 0) {
        console.log("Vega: found file inputs but none matched resume heuristics");
      }
    });
  }

  // 4. Small status toast so the user knows whether autofill landed anything.
  try {
    const prior = document.getElementById('vega-autofill-toast');
    if (prior) prior.remove();
    const toast = document.createElement('div');
    toast.id = 'vega-autofill-toast';
    toast.textContent = filledCount > 0
      ? `Vega: filled ${filledCount} field${filledCount === 1 ? '' : 's'}`
      : 'Vega: no fields matched — check the page for an unsupported form layout';
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 2147483647;
      background-color: ${filledCount > 0 ? '#ecfdf5' : '#fef2f2'};
      color: ${filledCount > 0 ? '#065f46' : '#991b1b'};
      border: 1px solid ${filledCount > 0 ? '#a7f3d0' : '#fecaca'};
      padding: 10px 16px; border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
      font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 500;
      pointer-events: none; transition: opacity 0.4s ease-in-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 4000);
  } catch (e) { /* ignore */ }

  console.log(`Vega Autofill complete. Filled ${filledCount} fields.`);
};
