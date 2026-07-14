window.runVegaAutofill = function(profile) {
  console.log("Vega Autofill started with profile:", profile);

  // Mirror key autofill events to the extension popup's Debug Logs panel so the
  // user can see, in the same extension, which fields were filled and with what,
  // when a brand-new field was detected and saved to their profile/DB, and when
  // a value they edited gets synced back. Falls back to console only when the
  // popup is closed.
  const trunc = (v) => {
    const s = v == null ? '' : String(v);
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  };
  const vegaLog = (msg) => {
    console.log(msg);
    try {
      chrome.runtime.sendMessage({ type: 'vegaLog', message: msg }, () => {
        // Swallow "Could not establish connection" when the popup is closed.
        void chrome.runtime.lastError;
      });
    } catch (e) { /* extension context unavailable */ }
  };

  // On-page, stacking notification — shown when a brand-new field is recorded
  // to the database with your info, so you get visible confirmation without
  // opening the popup.
  const vegaNotify = (msg) => {
    try {
      let container = document.getElementById('vega-notify-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'vega-notify-container';
        container.style.cssText = `
          position: fixed; top: 64px; right: 20px; z-index: 2147483647;
          display: flex; flex-direction: column; gap: 8px;
          font-family: system-ui, -apple-system, sans-serif; pointer-events: none;
        `;
        document.body.appendChild(container);
      }
      const note = document.createElement('div');
      note.textContent = '🆕 ' + msg;
      note.style.cssText = `
        background-color: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7;
        border-left: 4px solid #059669; padding: 10px 14px; border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        font-size: 13px; font-weight: 500; max-width: 320px;
        opacity: 0; transform: translateX(12px); transition: opacity .3s ease, transform .3s ease;
      `;
      container.appendChild(note);
      requestAnimationFrame(() => { note.style.opacity = '1'; note.style.transform = 'translateX(0)'; });
      setTimeout(() => {
        note.style.opacity = '0'; note.style.transform = 'translateX(12px)';
        setTimeout(() => note.remove(), 350);
      }, 5000);
    } catch (e) { /* ignore */ }
  };

  // Helper function to normalize text (strip accents, spaces, lowercase)
  const normalizeString = (str) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // removes accents
      .replace(/[^a-z0-9]/g, ' ') // replaces non-alphanumeric with spaces
      .replace(/\s+/g, ' ') // collapses spaces
      .trim();
  };

  // Classify a yes/no/decline EEO answer (veteran, disability) by intent rather
  // than exact wording, so a saved "I am not a protected veteran" still matches
  // a form option phrased "I am not a veteran". Returns 'yes' | 'no' | 'decline'
  // | null. `subjectKeywords` are the affirmative nouns for the question
  // (e.g. ['veteran'], ['disability']).
  const classifyAffirmation = (s, subjectKeywords) => {
    const n = normalizeString(s);
    if (!n) return null;
    const tokens = n.split(' ');
    const has = (w) => tokens.includes(w);
    if (n.includes('decline') || n.includes('prefer not') || n.includes('rather not') ||
        n.includes('not to answer') || n.includes('wish to answer') || n.includes('want to answer') ||
        n.includes('wish to disclose') || n.includes('want to disclose') ||
        n.includes('wish to provide') || n.includes('want to provide') ||
        n.includes('do not wish') || n.includes('dont wish') || n.includes('not wish') ||
        n.includes('no answer') || n.includes('choose not')) {
      return 'decline';
    }
    if (has('yes')) return 'yes';
    const negated = has('not') || has('no') || has('dont') || has('don') || has('non') || has('without') || has('havent');
    const mentionsSubject = (subjectKeywords || []).some(k => n.includes(k));
    if (mentionsSubject || negated) return negated ? 'no' : 'yes';
    return null;
  };

  // Helper to query all matching elements, including those inside Shadow DOMs
  const queryAllIncludingShadows = (selector, root = document) => {
    const elements = Array.from(root.querySelectorAll(selector));
    const findShadows = (node) => {
      if (node.shadowRoot) {
        elements.push(...node.shadowRoot.querySelectorAll(selector));
        Array.from(node.shadowRoot.querySelectorAll('*')).forEach(findShadows);
      }
    };
    Array.from(root.querySelectorAll('*')).forEach(findShadows);
    return elements;
  };

  const nameParts = (profile.user?.name || "").split(" ");
  // Mutable: partial-field edits (first/last name, city/state/country) update
  // these so later edits compose with the freshest values.
  let firstName = nameParts[0] || "";
  let lastName = nameParts.slice(1).join(" ") || "";

  let formattedPhone = profile.phone || "";
  if (formattedPhone && !formattedPhone.startsWith("+") && !formattedPhone.startsWith("1")) {
    formattedPhone = "+1 " + formattedPhone;
  } else if (formattedPhone && formattedPhone.startsWith("1")) {
    formattedPhone = "+" + formattedPhone;
  }

  // Address parsing
  let candidateCity = "";
  let candidateState = "";
  let candidateCountry = "";
  if (profile.targetLocations && profile.targetLocations.length > 0) {
    const loc = profile.targetLocations[0] || "";
    const parts = loc.split(',').map(s => s.trim());
    if (parts.length === 3) {
      candidateCity = parts[0];
      candidateState = parts[1];
      candidateCountry = parts[2];
    } else if (parts.length === 2) {
      candidateCity = parts[0];
      if (parts[1].length === 2 && parts[1] === parts[1].toUpperCase()) {
        candidateState = parts[1];
      } else {
        candidateCountry = parts[1];
      }
    } else if (parts.length === 1) {
      candidateCity = parts[0];
    }
  }

  // Work authorization parsing
  const authValue = (profile.workAuthorization || "").toLowerCase();
  let isAuthorized = true; // default true
  let requiresSponsorship = false; // default false
  if (authValue) {
    if (authValue.includes('sponsor') || authValue.includes('require') || authValue.includes('need') || authValue.includes('h1b') || authValue.includes('f1')) {
      requiresSponsorship = true;
    }
    if (authValue.includes('no') && authValue.includes('authorized')) {
      isAuthorized = false;
    }
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
    website: profile.portfolioUrl,
    salary: profile.minimumSalary ? String(profile.minimumSalary) : "",
    experience: profile.yearsOfExperience ? String(profile.yearsOfExperience) : "",
    city: candidateCity,
    state: candidateState,
    country: candidateCountry,
    location: profile.targetLocations && profile.targetLocations.length > 0 ? profile.targetLocations[0] : ""
  };

  // Keyword order and structure
  const fieldKeywords = {
    first_name: {
      exact: ['first_name', 'firstname', 'first-name', 'fname', 'first name', 'given name', 'givenname', 'given_name', 'nombre', 'primer nombre'],
      partial: ['first', 'nombre', 'given']
    },
    last_name: {
      exact: ['last_name', 'lastname', 'last-name', 'lname', 'last name', 'surname', 'family name', 'familyname', 'family_name', 'apellido', 'apellidos'],
      partial: ['last', 'apellido', 'surname']
    },
    name: {
      exact: ['full_name', 'fullname', 'full name', 'full-name', 'name', 'nombre completo', 'nombre y apellido', 'nombre y apellidos'],
      partial: ['name', 'nombre']
    },
    email: {
      exact: ['email', 'e-mail', 'e_mail', 'emailaddress', 'correo', 'correo electrónico', 'correo electronico', 'email address'],
      partial: ['email', 'correo']
    },
    phone: {
      exact: ['phone', 'tel', 'telephone', 'mobile', 'cell', 'phonenumber', 'telefono', 'teléfono', 'celular', 'phone number', 'contact number'],
      partial: ['phone', 'tel', 'mobil']
    },
    linkedin: {
      exact: ['linkedin', 'linked-in', 'linked_in', 'linked in', 'linkedin profile', 'linkedin url', 'linkedin profile url', 'perfil de linkedin', 'perfil linkedin'],
      partial: ['linkedin']
    },
    github: {
      exact: ['github', 'git_hub', 'git hub', 'git-hub', 'github profile', 'github url', 'perfil de github'],
      partial: ['github']
    },
    portfolio: {
      exact: ['portfolio', 'website', 'personal site', 'personal-site', 'personalsite', 'personal website', 'web site', 'web_site', 'sitio web', 'portafolio', 'portfolio url', 'website url'],
      // 'url' deliberately absent: any "<platform> URL" field (Twitter URL,
      // Other website URL, …) would otherwise score as portfolio.
      partial: ['portfolio', 'website', 'sitio']
    },
    salary: {
      exact: ['desired salary', 'salary expectation', 'salary expectations', 'expected salary', 'compensation', 'target salary', 'salario deseado', 'expectativa salarial', 'pretensión salarial', 'desired pay', 'expected pay'],
      partial: ['salary', 'salario', 'compensation', 'pay']
    },
    experience: {
      exact: ['years of experience', 'years of professional experience', 'total experience', 'experiencia laboral', 'años de experiencia', 'anos de experiencia', 'years of work experience'],
      partial: ['experience', 'experiencia', 'years']
    },
    city: {
      exact: ['city', 'town', 'ciudad', 'localidad', 'municipio'],
      partial: ['city', 'ciudad']
    },
    state: {
      exact: ['state', 'province', 'estado', 'provincia', 'región'],
      partial: ['state', 'estado', 'province']
    },
    country: {
      exact: ['country', 'nation', 'país', 'pais', 'nationality'],
      partial: ['country', 'pais']
    },
    location: {
      exact: ['location', 'address', 'direccion', 'dirección', 'ubicacion', 'ubicación', 'current location', 'where are you located', 'home address', 'current city', 'ciudad actual', 'location city', 'from where do you intend to work', 'where do you intend to work', 'city and state', 'please list city and state', 'current city and state', 'where are you based', 'where are you currently located'],
      partial: ['location', 'address', 'ubicacion', 'direccion', 'intend to work', 'city and state']
    }
  };

  const autocompleteMapping = {
    'given-name': 'first_name',
    'family-name': 'last_name',
    'name': 'name',
    'email': 'email',
    'tel': 'phone',
    'url': 'portfolio',
    'address-level2': 'city',
    'address-level1': 'state',
    'country': 'country',
    'street-address': 'location',
    'postal-code': 'location'
  };

  // SmartRecruiters/Workday/Lever/Greenhouse semantic name search helper
  const getFieldText = (el) => {
    const parts = [];
    const push = (s) => { if (s && typeof s === 'string') parts.push(s.trim()); };

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

    if (el.className && typeof el.className === 'string') {
      push(el.className);
    }

    try {
      // A field that carries its own label must be scored on that label alone.
      // Ancestor containers hold NEIGHBORING questions' text (Ashby nests
      // several fields per container), which made e.g. "Current location"
      // leak into every field's signature and fill the whole form with the
      // same value. Ancestor text is only a fallback for unlabeled controls
      // (file dropzones and similar).
      let hasDirectLabel = false;
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl && (lbl.textContent || '').trim()) {
          push(lbl.textContent);
          hasDirectLabel = true;
        }
      }
      const wrap = el.closest('label');
      if (wrap && (wrap.textContent || '').trim()) {
        push(wrap.textContent);
        hasDirectLabel = true;
      }
      if ((el.getAttribute('aria-label') || '').trim()) hasDirectLabel = true; // pushed above

      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        labelledBy.split(/\s+/).forEach(refId => {
          const ref = document.getElementById(refId);
          if (ref && (ref.textContent || '').trim()) {
            push(ref.textContent);
            hasDirectLabel = true;
          }
        });
      }
      const describedBy = el.getAttribute('aria-describedby');
      if (describedBy) {
        describedBy.split(/\s+/).forEach(refId => {
          const ref = document.getElementById(refId);
          if (ref) push(ref.textContent);
        });
      }

      if (!hasDirectLabel) {
        // Traverse up to 3 levels of parents to collect dropzone / form group label texts
        let current = el.parentElement;
        let depth = 0;
        while (current && depth < 3) {
          // Only label-sized text — whole-form containers would leak every
          // question on the page into this field's signature.
          const parentText = (current.textContent || '').trim();
          if (parentText && parentText.length <= 200) {
            push(parentText);
          }
          push(current.getAttribute('data-qa'));
          push(current.getAttribute('data-testid'));
          push(current.id);

          current = current.parentElement;
          depth++;
        }
      }
    } catch (e) { /* ignore */ }

    return parts.join(' ');
  };

  // Traverses up DOM tree to find section level headings and classes for semantic boundary checks
  const getParentContextText = (el) => {
    const parts = [];
    let parent = el.parentElement;
    let depth = 0;
    while (parent && depth < 4) {
      if (parent.tagName === 'FIELDSET') {
        const legend = parent.querySelector('legend');
        if (legend) parts.push(legend.textContent);
      }
      const headings = parent.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(h => parts.push(h.textContent));
      
      if (parent.id) parts.push(parent.id);
      if (parent.className && typeof parent.className === 'string') parts.push(parent.className);
      
      parent = parent.parentElement;
      depth++;
    }
    return parts.join(' ');
  };

  // Native React/Vue event trigger helper
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

  // Selects need the same native-setter treatment as inputs: assigning
  // .value directly bypasses React's value tracker, so the framework keeps
  // its stale state, renders the old option, and mishandles the user's next
  // pick. Route the write through the prototype setter and fire input+change.
  const setNativeSelectValue = (select, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (setter && setter.set) {
      setter.set.call(select, value);
    } else {
      select.value = value;
    }
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Full synthetic "click" including pointer events — modern widgets
  // (Greenhouse's select) ignore bare MouseEvents and only react to
  // pointerdown/pointerup.
  const dispatchPointerClick = (el) => {
    try {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true }));
    } catch (e) { /* PointerEvent unsupported */ }
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    try {
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, isPrimary: true }));
    } catch (e) { /* ignore */ }
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  };

  // All programmatic fills run one at a time from a serial queue, ~200ms
  // apart, instead of firing in one synchronous burst — rapid-fire synthetic
  // events can trip debounced validation and other odd behaviors on some
  // sites. A task that returns a promise (combobox fills: open menu → type →
  // pick) HOLDS the queue until it completes: starting the next fill early
  // used to steal focus, close the open menu and leave the option unselected.
  // Each queued fill re-checks its preconditions when it runs, so nothing the
  // user did during the delay gets overwritten.
  const FILL_STAGGER_MS = 200;
  const fillQueue = [];
  let fillQueuePumping = false;
  const pumpFillQueue = async () => {
    if (fillQueuePumping) return;
    fillQueuePumping = true;
    while (fillQueue.length) {
      await new Promise(r => setTimeout(r, FILL_STAGGER_MS));
      const task = fillQueue.shift();
      try { await task(); } catch (e) { /* ignore */ }
    }
    fillQueuePumping = false;
  };
  const enqueueFill = (fn) => {
    fillQueue.push(fn);
    pumpFillQueue();
  };

  const highlight = (el) => { try { el.style.backgroundColor = '#e0e7ff'; } catch (e) {} };

  let filledCount = 0;

  // Elements handled by the standard mapping above. Anything NOT in here is a
  // candidate "custom field" we should learn and remember.
  const matchedElements = new WeakSet();

  // Extract a clean, human-readable question/label for a field — preferring the
  // associated <label>, aria-label, placeholder, or wrapping label. Unlike
  // getFieldText (which concatenates lots of attributes for fuzzy scoring), this
  // aims for the actual question a human would read.
  const getQuestionLabel = (el) => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    try {
      if (el.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl && clean(lbl.textContent)) return clean(lbl.textContent);
      }
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const txt = labelledBy.split(/\s+/).map(id => {
          const ref = document.getElementById(id);
          return ref ? ref.textContent : '';
        }).join(' ');
        if (clean(txt)) return clean(txt);
      }
      const wrap = el.closest('label');
      if (wrap) {
        const clone = wrap.cloneNode(true);
        clone.querySelectorAll('input, textarea, select, button').forEach(n => n.remove());
        if (clean(clone.textContent)) return clean(clone.textContent);
      }
      const aria = clean(el.getAttribute('aria-label'));
      if (aria) return aria;
      const ph = clean(el.getAttribute('placeholder'));
      if (ph) return ph;
      // Look upward for a nearby label/legend within the form group.
      let cur = el.parentElement;
      let depth = 0;
      while (cur && depth < 3) {
        const lbl = cur.querySelector('label, legend');
        if (lbl) {
          const clone = lbl.cloneNode(true);
          clone.querySelectorAll('input, textarea, select, button').forEach(n => n.remove());
          if (clean(clone.textContent)) return clean(clone.textContent);
        }
        cur = cur.parentElement;
        depth++;
      }
      const nm = clean(el.getAttribute('name'));
      if (nm) return nm;
    } catch (e) { /* ignore */ }
    return '';
  };

  // Smart heuristic score calculator for an input field
  const getScoreForField = (input, fieldKey) => {
    let score = 0;
    const textToMatch = getFieldText(input);
    const normalizedToMatch = normalizeString(textToMatch);
    if (!normalizedToMatch) return 0;

    const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase();
    
    // 1. Autocomplete match (highest weight)
    if (autocomplete) {
      for (const [autoToken, mappedKey] of Object.entries(autocompleteMapping)) {
        if (autocomplete.includes(autoToken) && mappedKey === fieldKey) {
          score += 150;
        }
      }
    }

    const rules = fieldKeywords[fieldKey];
    if (rules) {
      // Word-boundary matching: bare substring checks caused e.g. the exact
      // keyword "location" to match inside "If relocating ... for relocation".
      const tokens = normalizedToMatch.split(' ');
      const hasPhrase = (kw) => (' ' + normalizedToMatch + ' ').includes(' ' + kw + ' ');

      // 2. Exact keyword matches (whole text, whole token, or whole phrase)
      for (const kw of rules.exact) {
        const normKw = normalizeString(kw);
        if (normalizedToMatch === normKw || tokens.includes(normKw)) {
          score += 100;
        } else if (normKw.includes(' ') && hasPhrase(normKw)) {
          score += 60;
        }
      }

      // 3. Partial keyword matches (token prefix, so "mobil" still hits
      // "mobile"; multi-word partials match as whole phrases)
      for (const kw of rules.partial) {
        const normKw = normalizeString(kw);
        const hit = normKw.includes(' ')
          ? hasPhrase(normKw)
          : tokens.some(t => t === normKw || t.startsWith(normKw));
        if (hit) {
          score += 50;
        }
      }
    }

    // 4. Section Context & Penalties
    const contextText = getParentContextText(input);
    const normalizedContext = normalizeString(contextText);
    
    const isEmployerOrSchoolContext = 
      normalizedContext.includes('employer') || 
      normalizedContext.includes('company') || 
      normalizedContext.includes('previous') || 
      normalizedContext.includes('former') || 
      normalizedContext.includes('reference') || 
      normalizedContext.includes('school') || 
      normalizedContext.includes('university') || 
      normalizedContext.includes('education') || 
      normalizedContext.includes('trabajo anterior') || 
      normalizedContext.includes('empleador') ||
      normalizedContext.includes('colegio') ||
      normalizedContext.includes('universidad');

    if (isEmployerOrSchoolContext) {
      // Penalize candidates own information when filling employment/school names/phones/emails
      if (['first_name', 'last_name', 'name', 'email', 'phone'].includes(fieldKey)) {
        score -= 120;
      }
    }

    // A link field for a DIFFERENT platform (Lever's "Twitter URL", etc.) must
    // not receive our LinkedIn/GitHub/portfolio values — leave it to
    // custom-field learning so the user's own answer is remembered instead.
    const fieldTokens = normalizedToMatch.split(' ');
    if (['linkedin', 'github', 'portfolio'].includes(fieldKey)) {
      const OTHER_PLATFORMS = ['twitter', 'instagram', 'facebook', 'dribbble', 'behance', 'medium', 'youtube', 'stackoverflow', 'kaggle'];
      if (OTHER_PLATFORMS.some(p => fieldTokens.includes(p))) {
        score -= 120;
      }
    }
    // "Other …" catch-all fields (Lever's "Other website") are ambiguous —
    // better remembered per user as custom fields than guessed.
    if (fieldTokens.includes('other') || fieldTokens.includes('otro') || fieldTokens.includes('otra')) {
      score -= 120;
    }

    // Yes/no questions phrased around a place — "authorized to work in the
    // country…", "require sponsorship … in the country…", "do you reside in
    // the location specified…" — must not be treated as location fields (they
    // used to get the location typed into them). Custom-field learning
    // remembers the user's yes/no answer instead. Questions asking FOR a
    // place ("What state do you reside in?", "From where do you intend to
    // work?") contain "what"/"where" and stay location fields.
    if (['country', 'city', 'state', 'location'].includes(fieldKey)) {
      if (normalizedToMatch.includes('authorized') || normalizedToMatch.includes('authorization') ||
          normalizedToMatch.includes('sponsor') || normalizedToMatch.includes('visa') ||
          normalizedToMatch.includes('eligible') || normalizedToMatch.includes('eligibility')) {
        score -= 150;
      }
      const padded = ' ' + normalizedToMatch + ' ';
      const yesNoPhrased = padded.includes(' do you ') || padded.includes(' are you ') ||
        padded.includes(' have you ') || padded.includes(' will you ');
      const asksForPlace = fieldTokens.includes('where') || fieldTokens.includes('what') || fieldTokens.includes('which');
      if (yesNoPhrased && !asksForPlace) {
        score -= 150;
      }
    }

    return score;
  };

  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio', 'file', 'password', 'range', 'color']);

  // ── Typeahead / combobox fields (e.g. Greenhouse "Location (City)" and the
  // phone "Country" selector) ─────────────────────────────────────────────────
  // These React widgets ignore a directly-set value: you must "type" into them
  // so the suggestion list opens, then click a matching option. This is a best-
  // effort handler — it types the value, waits for options, and selects the
  // option whose text best matches.
  // Returns a promise that resolves once the pick has been made and the
  // widget has had a moment to settle — the fill queue awaits it so the next
  // fill can't steal focus and close this menu mid-selection.
  const selectFromTypeahead = (input, value) => new Promise((resolve) => {
    try {
      input.focus();
      // Open the menu via a pointer-event click on the widget's control —
      // typing alone doesn't open some builds (Greenhouse ignores synthetic
      // keyboard/input events until the menu is open).
      const control = input.closest('[class*="control" i]') || input.parentElement;
      if (control) dispatchPointerClick(control);
      setNativeValue(input, value);
      const lastChar = value.slice(-1) || 'a';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, bubbles: true }));

      // Options can load from the network (Greenhouse's city search) — poll
      // for them for up to ~3.5s instead of checking once.
      let attempts = 0;
      const tryPick = () => {
        attempts++;
        let picked = false;
        try {
          let listbox = null;
          const ctrl = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
          if (ctrl) listbox = document.getElementById(ctrl);
          if (!listbox) {
            const wrap = input.closest('div, fieldset, section');
            if (wrap) listbox = wrap.querySelector('[role="listbox"]');
          }
          if (!listbox) listbox = document.querySelector('[role="listbox"]');

          const options = listbox
            ? Array.from(listbox.querySelectorAll('[role="option"], li'))
            : Array.from(document.querySelectorAll('[role="option"]'));
          if (!options.length) {
            if (attempts < 8) {
              setTimeout(tryPick, 400);
              return;
            }
            vegaLog(`• Typed "${trunc(value)}" into a typeahead, but no suggestions appeared — you may need to pick one manually.`);
          } else {
            const normVal = normalizeString(value);
            const target = options.find(o => normalizeString(o.textContent) === normVal)
              || options.find(o => normalizeString(o.textContent).includes(normVal))
              || options[0];
            if (target) {
              target.scrollIntoView({ block: 'nearest' });
              dispatchPointerClick(target);
              picked = true;
              filledCount++;
              highlight(input);
              vegaLog(`✓ Selected "${trunc((target.textContent || '').trim())}" from a typeahead`);
            }
          }
        } catch (e) { /* ignore */ }
        setTimeout(resolve, picked ? 250 : 100); // let the widget commit before the next fill
      };
      setTimeout(tryPick, 800);
    } catch (e) { resolve(); }
  });

  const fillTypeaheadComboboxes = () => {
    const combos = queryAllIncludingShadows(
      'input[role="combobox"], input[aria-autocomplete="list"], input[aria-autocomplete="both"]'
    );
    combos.forEach(input => {
      if (input.disabled || input.readOnly) return;
      if (input.value && input.value.trim() !== '') return;
      if (matchedElements.has(input)) return;

      const norm = normalizeString(getFieldText(input));
      const isLocation = ['location', 'city', 'ciudad', 'where are you', 'intend to work', 'where do you'].some(k => norm.includes(k));
      const isPhoneCountry = norm.includes('country') && (norm.includes('phone') || norm.includes('dial') || norm.includes('code') || norm.includes('telefono'));

      const fillCombo = (val) => {
        matchedElements.add(input);
        enqueueFill(() => {
          if ((input.value || '').trim() || readComboboxSelection(input)) return; // user got there first
          return selectFromTypeahead(input, val); // holds the queue until picked
        });
      };
      if (isLocation) {
        const val = candidateCity || (profile.targetLocations && profile.targetLocations[0]) || '';
        if (val) fillCombo(val);
      } else if (isPhoneCountry) {
        fillCombo(candidateCountry || 'United States');
      }
    });
  };

  // ── Standard-field profile sync ─────────────────────────────────────────────
  // Standard fields (name, email, phone, location, LinkedIn, …) are filled from
  // the candidate profile rather than the learned-fields table. To honor "if I
  // edit any field it must update the DB", we also watch these fields: when the
  // user types or changes one on the page, the new value is written back to
  // their Vega profile so it's remembered everywhere. Composite/partial fields
  // (first/last name, city/state/country) are skipped to avoid clobbering.
  const SYNCABLE_KEYS = new Set([
    'email', 'name', 'first_name', 'last_name', 'phone', 'linkedin', 'github',
    'portfolio', 'website', 'location', 'salary', 'experience', 'city', 'state', 'country',
  ]);

  const buildProfilePatch = (fieldKey, value) => {
    const v = (value || '').trim();
    if (!v) return null;
    switch (fieldKey) {
      case 'email':     return { user: { email: v } };
      case 'name':      return { user: { name: v } };
      // Partial fields compose with the stored other half, and refresh it so a
      // follow-up edit to the counterpart composes with this new value.
      case 'first_name': firstName = v; return { user: { name: `${v} ${lastName}`.trim() } };
      case 'last_name':  lastName = v;  return { user: { name: `${firstName} ${v}`.trim() } };
      case 'city':    candidateCity = v;    return { targetLocations: [[v, candidateState, candidateCountry].filter(Boolean).join(', ')] };
      case 'state':   candidateState = v;   return { targetLocations: [[candidateCity, v, candidateCountry].filter(Boolean).join(', ')] };
      case 'country': candidateCountry = v; return { targetLocations: [[candidateCity, candidateState, v].filter(Boolean).join(', ')] };
      case 'phone':     return { phone: v };
      case 'linkedin':  return { linkedInUrl: v };
      case 'github':    return { githubUrl: v };
      case 'portfolio':
      case 'website':   return { portfolioUrl: v };
      case 'location':  return { targetLocations: [v] };
      case 'salary':    { const n = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : { minimumSalary: n }; }
      case 'experience':{ const n = parseInt(v.replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : { yearsOfExperience: n }; }
      default:          return null;
    }
  };

  const attachStandardSync = (input, fieldKey) => {
    if (input.__vegaStdListener) return;
    if (!SYNCABLE_KEYS.has(fieldKey)) return; // not a syncable field
    input.__vegaStdListener = true;
    input.__vegaStdLast = (input.value || '').trim();
    // Only real keystrokes are trusted events — synthetic fills (ours or the
    // ATS's resume parse) are not. Lets the late-parse guard tell "the user
    // typed here, leave it alone" apart from "the page overwrote our fill".
    input.addEventListener('input', (e) => { if (e.isTrusted) input.__vegaUserEdited = true; }, true);
    const handler = () => {
      const value = (input.value || '').trim();
      if (!value || value === input.__vegaStdLast) return;
      const patch = buildProfilePatch(fieldKey, value);
      if (!patch) return;
      input.__vegaStdLast = value;
      try {
        chrome.runtime.sendMessage({ type: 'vegaSaveProfileField', patch, fieldKey, value }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok) vegaLog(`✎ Updated your Vega profile: "${fieldKey}" = "${trunc(value)}"`);
          else vegaLog(`⚠ Could not update profile "${fieldKey}": ${resp && resp.error ? resp.error : 'no response'}`);
        });
      } catch (e) { /* extension context may be gone */ }
    };
    input.addEventListener('change', handler);
    input.addEventListener('blur', handler);
  };

  // Standard fields we set from the profile, watched by the late-parse guard so
  // an ATS resume parse that lands after our fill can't silently undo it.
  const standardFills = [];

  const fillTextAndFormFields = (opts = {}) => {
  // When a resume was just uploaded, the ATS may have pre-filled fields from
  // its parse; the profile is the source of truth, so overwrite differing
  // values (but never a field the user typed in themselves).
  const overwriteStandard = !!opts.overwriteStandard;
  // 1. Fill text-shaped inputs and textareas (query including Shadow DOMs)
  const candidates = queryAllIncludingShadows('input, textarea');
  candidates.forEach(input => {
    if (input.tagName === 'INPUT' && SKIP_TYPES.has((input.type || '').toLowerCase())) return;
    if (input.disabled || input.readOnly) return;
    // Textareas on these ATS forms are free-text questions, never identity
    // fields. Skip standard mapping so we don't bleed e.g. the first name into a
    // "What is your preferred first and last name?" box — they're captured by
    // the custom-field learning pass instead.
    if (input.tagName === 'TEXTAREA') return;

    let bestKey = null;
    let bestScore = 30; // Threshold to prevent bad mappings

    for (const fieldKey of Object.keys(fieldKeywords)) {
      const score = getScoreForField(input, fieldKey);
      if (score > bestScore) {
        bestScore = score;
        bestKey = fieldKey;
      }
    }

    if (bestKey) {
      matchedElements.add(input);
      const valToSet = fieldMapping[bestKey];
      console.log(`Vega: Matched field "${bestKey}" with score ${bestScore} for input:`, input);
      const wanted = valToSet ? String(valToSet).trim() : '';

      if (isComboboxEl(input)) {
        // Combobox-backed standard fields (Greenhouse's Country / Location):
        // typing text into them never commits a value, so pick from the menu
        // instead — once only, and never over an existing selection. The
        // user's own picks are recorded as a remembered answer.
        const sig = buildFieldSignature(input);
        if (sig) attachCustomFieldListener(input, sig);
        // Location-ish comboboxes search remote city lists — query with just
        // the city, not the full "City, State, Country" string.
        const comboValue = (bestKey === 'location' || bestKey === 'city') && candidateCity ? candidateCity : wanted;
        if (comboValue && !input.__vegaComboFilled && !(input.value || '').trim() && !readComboboxSelection(input)) {
          input.__vegaComboFilled = true;
          input.__vegaLastSaved = comboValue; // our own pick is not a user answer
          enqueueFill(() => {
            if ((input.value || '').trim() || readComboboxSelection(input)) return; // user got there first
            return selectFromTypeahead(input, comboValue); // holds the queue until picked
          });
        }
        return;
      }

      // Remember the user's edits to this standard field (synced to profile).
      attachStandardSync(input, bestKey);
      const current = (input.value || '').trim();
      const canOverwrite = overwriteStandard && !input.__vegaUserEdited;
      if (wanted && current === wanted) {
        standardFills.push({ el: input, value: wanted }); // already correct — still guard it
      } else if (wanted && (current === '' || canOverwrite) && !input.__vegaFillQueued) {
        input.__vegaFillQueued = true;
        standardFills.push({ el: input, value: wanted });
        filledCount++;
        const wasEmpty = current === '';
        enqueueFill(() => {
          input.__vegaFillQueued = false;
          if (input.__vegaUserEdited) return; // user typed here during the stagger
          const cur = (input.value || '').trim();
          if (cur === wanted) return;
          if (cur !== '' && !overwriteStandard) return;
          input.__vegaStdLast = wanted; // don't treat our own fill as a user edit
          setNativeValue(input, wanted);
          highlight(input);
          vegaLog(wasEmpty
            ? `✓ Filled field "${bestKey}" → "${trunc(wanted)}"`
            : `↻ Replaced page value of "${bestKey}" with your profile's → "${trunc(wanted)}"`);
        });
      } else if (!valToSet) {
        // The field was recognized but there's nothing to put in it — tell the
        // user so they know to fill it in their Vega profile (this is the usual
        // reason phone/LinkedIn/etc. "don't autofill").
        vegaLog(`• Found "${bestKey}" on the form, but your Vega profile has no value for it — add it in your profile so it autofills next time.`);
      } else {
        console.log(`Vega: Skipped "${bestKey}" (already filled: "${input.value}")`);
      }
    } else {
      console.log(`Vega: No matched field key (highest score under 30) for input:`, input, "Texts gathered:", getFieldText(input));
    }
  });

  // 2. Handle Radio Buttons (Query including Shadow DOMs)
  const radioInputs = queryAllIncludingShadows('input[type="radio"]');
  const radioGroups = {};
  
  radioInputs.forEach(radio => {
    const name = radio.getAttribute('name');
    if (name) {
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(radio);
    } else {
      const parentGroup = radio.closest('.form-group, fieldset, div');
      if (parentGroup) {
        const id = parentGroup.id || parentGroup.className || 'group-' + Math.random().toString(36).substr(2, 9);
        if (!radioGroups[id]) radioGroups[id] = [];
        radioGroups[id].push(radio);
      }
    }
  });

  for (const [groupName, radios] of Object.entries(radioGroups)) {
    if (radios.length < 2) continue;
    // Fill-once: if any option is already selected (by the user or a draft
    // restore), leave the group alone instead of forcing the profile answer.
    if (radios.some(r => r.checked)) continue;
    
    let questionText = "";
    const firstRadio = radios[0];
    
    const fieldset = firstRadio.closest('fieldset');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) questionText += " " + legend.textContent;
    }
    
    const formGroup = firstRadio.closest('.form-group, .radio-group, div');
    if (formGroup) {
      let text = formGroup.textContent || "";
      radios.forEach(r => {
        const label = r.closest('label');
        if (label) {
          text = text.replace(label.textContent, "");
        }
      });
      questionText += " " + text;
    }
    
    const normQuestion = normalizeString(questionText);
    if (!normQuestion) continue;

    let targetSelection = null;

    const isAuthQuestion = 
      (normQuestion.includes('authorize') || normQuestion.includes('legal') || normQuestion.includes('permiso')) && 
      (normQuestion.includes('work') || normQuestion.includes('trabajar') || normQuestion.includes('empleo'));
    
    const isSponsorshipQuestion = 
      (normQuestion.includes('sponsor') || normQuestion.includes('patrocinio') || normQuestion.includes('visa')) && 
      (normQuestion.includes('require') || normQuestion.includes('need') || normQuestion.includes('requerir') || normQuestion.includes('futuro') || normQuestion.includes('future'));

    const isGenderQuestion = normQuestion.includes('gender') || normQuestion.includes('sex ') || normQuestion.endsWith(' sex') || normQuestion.includes('genero');
    const isVeteranQuestion = normQuestion.includes('veteran') || normQuestion.includes('veterano');
    const isDisabilityQuestion = normQuestion.includes('disability') || normQuestion.includes('discapacidad') || normQuestion.includes('handicap');

    if (isAuthQuestion) {
      targetSelection = isAuthorized ? 'yes' : 'no';
    } else if (isSponsorshipQuestion) {
      targetSelection = requiresSponsorship ? 'yes' : 'no';
    } else if (isGenderQuestion && profile.gender) {
      targetSelection = profile.gender;
    } else if (isVeteranQuestion && profile.veteranStatus) {
      targetSelection = profile.veteranStatus;
    } else if (isDisabilityQuestion && profile.disabilityStatus) {
      targetSelection = profile.disabilityStatus;
    }

    if (targetSelection) {
      radios.forEach(r => matchedElements.add(r));
      let selectedRadio = null;

      for (const radio of radios) {
        let labelText = "";
        if (radio.id) {
          const lbl = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
          if (lbl) labelText = lbl.textContent;
        }
        if (!labelText) {
          const parentLabel = radio.closest('label');
          if (parentLabel) labelText = parentLabel.textContent;
        }
        
        const normLabel = normalizeString(labelText || radio.value);
        
        if (targetSelection === 'yes') {
          if (['yes', 'si', 'y', 's', 'true', 'authorized', 'autorizado'].includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
        } else if (targetSelection === 'no') {
          if (['no', 'n', 'false', 'not', 'none', 'ninguno'].includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
        } else {
          const normTarget = normalizeString(targetSelection);
          if (normLabel.includes(normTarget) || normTarget.includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
          if (normTarget === 'male' && ['male', 'man', 'm', 'masculino', 'hombre'].includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
          if (normTarget === 'female' && ['female', 'woman', 'f', 'femenino', 'mujer'].includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
          if (normTarget === 'non binary' && ['non-binary', 'nonbinary', 'genderqueer', 'no binario'].includes(normLabel)) {
            selectedRadio = radio;
            break;
          }
          if (normTarget.includes('decline') && (normLabel.includes('decline') || normLabel.includes('prefer not') || normLabel.includes('no decir') || normLabel.includes('no declarar'))) {
            selectedRadio = radio;
            break;
          }
        }
      }

      if (selectedRadio && !selectedRadio.checked && !selectedRadio.__vegaFillQueued) {
        selectedRadio.__vegaFillQueued = true;
        filledCount++;
        enqueueFill(() => {
          selectedRadio.__vegaFillQueued = false;
          if (radios.some(r => r.checked)) return; // user picked during the stagger
          selectedRadio.checked = true;
          selectedRadio.dispatchEvent(new Event('change', { bubbles: true }));
          selectedRadio.dispatchEvent(new Event('click', { bubbles: true }));
          highlight(selectedRadio.closest('label') || selectedRadio);
          vegaLog(`✓ Selected option "${trunc(selectedRadio.value || targetSelection)}" for a multiple-choice question`);
        });
      }
    }
  }

  // 3. Handle Checkboxes (Query including Shadow DOMs)
  const checkboxes = queryAllIncludingShadows('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    if (checkbox.disabled) return;
    
    let labelText = "";
    if (checkbox.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`);
      if (lbl) labelText = lbl.textContent;
    }
    if (!labelText) {
      const parentLabel = checkbox.closest('label');
      if (parentLabel) labelText = parentLabel.textContent;
    }
    
    const normLabel = normalizeString(labelText || checkbox.name || checkbox.id);
    if (!normLabel) return;

    const isSponsorshipCheckbox = 
      (normLabel.includes('sponsor') || normLabel.includes('visa')) && 
      (normLabel.includes('require') || normLabel.includes('need') || normLabel.includes('requiero'));
      
    if (isSponsorshipCheckbox) {
      matchedElements.add(checkbox); // handled here — keep it out of checkbox learning
      if (checkbox.__vegaFilledOnce) return; // don't undo the user's toggle on rescans
      checkbox.__vegaFilledOnce = true;
      const targetState = requiresSponsorship;
      if (checkbox.checked !== targetState) {
        filledCount++;
        enqueueFill(() => {
          if (checkbox.checked === targetState) return;
          checkbox.checked = targetState;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          highlight(checkbox.closest('label') || checkbox);
          vegaLog(`✓ ${targetState ? 'Checked' : 'Unchecked'} sponsorship checkbox`);
        });
      }
    }
  });

  // 4. Native <select> dropdowns (Query including Shadow DOMs)
  const selects = queryAllIncludingShadows('select');
  selects.forEach(select => {
    if (select.disabled) return;
    // Fill-once: a select that already has a value (user's pick, page
    // default, or an earlier fill) must not be overridden — the dynamic
    // rescan used to snap the menu straight back to the profile value after
    // the user chose a different option.
    if ((select.value || '').trim() !== '') return;
    const labelText = getFieldText(select);
    const normLabel = normalizeString(labelText);

    const matchAndSetOption = (targetValue) => {
      if (!targetValue) return;
      const normTarget = normalizeString(targetValue);
      // Staged matching: exact equality, then curated synonyms, then loose
      // substring LAST — "female".includes("male") is true, so a loose pass
      // running first used to select Male for a Female target.
      const findOption = () => {
        for (const option of select.options) {
          if (normalizeString(option.text || option.value) === normTarget) return option;
        }
        for (const option of select.options) {
          const normOpt = normalizeString(option.text || option.value);
          if (normTarget === 'male' && ['male', 'man', 'm', 'masculino', 'hombre'].includes(normOpt)) return option;
          if (normTarget === 'female' && ['female', 'woman', 'f', 'femenino', 'mujer'].includes(normOpt)) return option;
          if (normTarget === 'non binary' && ['non-binary', 'nonbinary', 'genderqueer', 'no binario'].includes(normOpt)) return option;
          if (normTarget.includes('decline') && (normOpt.includes('decline') || normOpt.includes('prefer not') || normOpt.includes('no decir') || normOpt.includes('no declarar'))) return option;
        }
        for (const option of select.options) {
          if (!option.value) continue; // never loose-match the placeholder
          const normOpt = normalizeString(option.text || option.value);
          if (normOpt.includes(normTarget) || normTarget.includes(normOpt)) return option;
        }
        return null;
      };
      const option = findOption();
      if (option && select.value !== option.value) {
        filledCount++;
        enqueueFill(() => {
          if ((select.value || '').trim() !== '') return; // user picked during the stagger
          setNativeSelectValue(select, option.value);
          highlight(select);
          vegaLog(`✓ Selected "${trunc(option.text || option.value)}" from a dropdown`);
        });
      }
    };

    // Polarity-aware selector for yes/no/decline EEO questions (veteran,
    // disability), whose wording differs a lot between ATS providers. Returns
    // true if it set an option, so the caller can fall back to substring match.
    const matchByAffirmation = (targetValue, subjectKeywords) => {
      if (!targetValue) return false;
      const want = classifyAffirmation(targetValue, subjectKeywords);
      if (!want) return false;
      for (const option of select.options) {
        if (!option.value) continue; // skip the "Select…" placeholder
        if (classifyAffirmation(option.text || option.value, subjectKeywords) === want) {
          if (select.value !== option.value) {
            filledCount++;
            enqueueFill(() => {
              if ((select.value || '').trim() !== '') return; // user picked during the stagger
              setNativeSelectValue(select, option.value);
              highlight(select);
              vegaLog(`✓ Selected "${trunc(option.text || option.value)}" from a dropdown`);
            });
          }
          return true;
        }
      }
      return false;
    };

    // Work-authorization and sponsorship questions usually mention "the
    // country in which you are applying" — they must be classified BEFORE the
    // country selector, which used to claim them and answer "USA".
    const isAuthQuestion = (normLabel.includes('authorize') || normLabel.includes('legally')) &&
      (normLabel.includes('work') || normLabel.includes('employment'));
    const isSponsorQuestion = (normLabel.includes('sponsor') || normLabel.includes('visa')) &&
      (normLabel.includes('require') || normLabel.includes('need') || normLabel.includes('future') || normLabel.includes('now'));

    if (isAuthQuestion) {
      matchedElements.add(select);
      if (!matchByAffirmation(isAuthorized ? 'yes' : 'no', ['authorized', 'legally']))
        matchAndSetOption(isAuthorized ? 'yes' : 'no');
    } else if (isSponsorQuestion) {
      matchedElements.add(select);
      if (!matchByAffirmation(requiresSponsorship ? 'yes' : 'no', ['sponsorship', 'sponsor', 'visa']))
        matchAndSetOption(requiresSponsorship ? 'yes' : 'no');
    } else if (normLabel.includes('country') || normLabel.includes('nationality') || normLabel.includes('pais') || normLabel.includes('nacionalidad')) {
      matchedElements.add(select);
      const targetCountry = candidateCountry || 'united states';
      const normTarget = normalizeString(targetCountry);
      for (const option of select.options) {
        if (!option.value) continue; // skip the "Select…" placeholder
        const normOpt = normalizeString(option.text || option.value);
        if (normOpt === normTarget || normOpt.includes(normTarget) || normTarget.includes(normOpt) ||
            (normTarget === 'united states' && ['us', 'usa', 'united states of america'].includes(normOpt))) {
          filledCount++;
          enqueueFill(() => {
            if ((select.value || '').trim() !== '') return; // user picked during the stagger
            setNativeSelectValue(select, option.value);
            highlight(select);
            vegaLog(`✓ Selected country "${trunc(option.text || option.value)}"`);
          });
          break;
        }
      }
    } else if (normLabel.includes('gender') || normLabel.includes('sex ') || normLabel.endsWith(' sex') || normLabel.includes('genero')) {
      matchedElements.add(select);
      matchAndSetOption(profile.gender);
    } else if (normLabel.includes('race') || normLabel.includes('ethnic') || normLabel.includes('raza') || normLabel.includes('etnia')) {
      matchedElements.add(select);
      matchAndSetOption(profile.race);
    } else if (normLabel.includes('veteran') || normLabel.includes('veterano')) {
      matchedElements.add(select);
      if (!matchByAffirmation(profile.veteranStatus, ['veteran', 'protected']))
        matchAndSetOption(profile.veteranStatus);
    } else if (normLabel.includes('disability') || normLabel.includes('handicap') || normLabel.includes('discapacidad')) {
      matchedElements.add(select);
      if (!matchByAffirmation(profile.disabilityStatus, ['disability', 'disabled', 'impairment', 'condition', 'discapacidad']))
        matchAndSetOption(profile.disabilityStatus);
    }
  });
  // Best-effort fill for React typeahead/combobox fields (Location, phone Country).
  fillTypeaheadComboboxes();
  }; // end fillTextAndFormFields

  // ── Custom field learning ──────────────────────────────────────────────────
  // After standard fields are filled, find every remaining (unmatched) input the
  // candidate would have to answer manually, build a stable signature for each,
  // and sync with the backend: previously-answered fields get filled in, brand
  // new ones get recorded so they appear in the profile UI. We also watch these
  // fields so any value the user types is saved and reused next time.

  const buildFieldSignature = (el) => {
    const label = getQuestionLabel(el);
    if (!label || label.length < 2) return null;
    // Skip noisy/huge labels that are clearly not a single question.
    if (label.length > 400) return null;

    let fieldType = 'text';
    if (el.tagName === 'TEXTAREA') fieldType = 'textarea';
    else if (el.tagName === 'SELECT') fieldType = 'select';
    else if (el.tagName === 'INPUT') fieldType = (el.type || 'text').toLowerCase();

    const fieldKey = normalizeString(label).slice(0, 300);
    if (!fieldKey) return null;

    const options = [];
    if (el.tagName === 'SELECT') {
      for (const opt of el.options) {
        const t = (opt.text || opt.value || '').trim();
        if (!t) continue;
        const nt = normalizeString(t);
        // Skip placeholder options so the saved dropdown is clean.
        if (!opt.value || nt === 'select' || nt.startsWith('select ') || nt === 'please select' ||
            nt === 'choose' || nt === 'seleccionar' || nt === 'selecciona' || nt === 'none') {
          continue;
        }
        options.push(t);
        if (options.length >= 100) break; // guard against runaway lists
      }
    }
    return { fieldKey, label, fieldType, options };
  };

  const setCustomValue = (el, value) => {
    if (value == null || value === '') return false;
    if (el.__vegaFillQueued) return false;
    if (el.tagName === 'SELECT') {
      // Fill-once: never override a select the user (or page) already set.
      if ((el.value || '').trim() !== '') return false;
      const normTarget = normalizeString(value);
      for (const option of el.options) {
        const normOpt = normalizeString(option.text || option.value);
        if (normOpt === normTarget || normOpt.includes(normTarget) || normTarget.includes(normOpt)) {
          if (el.value !== option.value) {
            el.__vegaFillQueued = true;
            enqueueFill(() => {
              el.__vegaFillQueued = false;
              if ((el.value || '').trim() !== '') return; // user picked during the stagger
              setNativeSelectValue(el, option.value);
            });
            return true;
          }
          return false;
        }
      }
      return false;
    }
    if (!el.value || el.value.trim() === '') {
      el.__vegaFillQueued = true;
      enqueueFill(() => {
        el.__vegaFillQueued = false;
        if (el.value && el.value.trim() !== '') return; // user typed during the stagger
        setNativeValue(el, value);
      });
      return true;
    }
    return false;
  };

  // Returns true if an element behaves like a typeahead/combobox (react-select,
  // Downshift, etc.) where the value is chosen from an opening option list.
  const isComboboxEl = (el) => {
    try {
      return el.tagName !== 'SELECT' && (el.getAttribute('role') === 'combobox' || !!el.getAttribute('aria-autocomplete'));
    } catch (e) { return false; }
  };

  // Read a field's *human-readable* value — for a native <select> that's the
  // selected option's text (not its opaque value attribute), so the answer is
  // reusable on other sites. Placeholder selections ("Select…") return ''.
  const readFieldValue = (el) => {
    if (el.tagName === 'SELECT') {
      const opt = el.options ? el.options[el.selectedIndex] : null;
      if (!opt) return '';
      const t = (opt.text || opt.value || '').trim();
      const nt = normalizeString(t);
      if (!opt.value || !nt || nt === 'select' || nt.startsWith('select ') ||
          nt === 'please select' || nt === 'seleccionar' || nt === 'selecciona' ||
          nt === 'choose' || nt === 'none') {
        return '';
      }
      return t;
    }
    return el.value;
  };

  // After picking from a react-select/combobox, the typed input is cleared and
  // the chosen label is rendered in a SIBLING subtree (e.g. Greenhouse's
  // ".select__single-value" sits next to the input's own container, not
  // inside it) — walk a few ancestors and search each for the value node.
  const readComboboxSelection = (el) => {
    try {
      // Two levels only: react-select keeps the single-value inside the
      // value-container (the input's grandparent). Walking further crosses
      // into NEIGHBORING widgets' values (e.g. the phone "+1" selector next
      // to Country) and misreports this one as already selected.
      let anc = el.parentElement;
      let depth = 0;
      while (anc && depth < 2) {
        const sv = anc.querySelector('[class*="singleValue" i], [class*="single-value" i], [class*="multiValue" i], [class*="multi-value" i]');
        if (sv && sv.textContent && sv.textContent.trim()) return sv.textContent.trim();
        anc = anc.parentElement;
        depth++;
      }
      const act = el.getAttribute && el.getAttribute('aria-activedescendant');
      if (act) { const o = document.getElementById(act); if (o && o.textContent && o.textContent.trim()) return o.textContent.trim(); }
    } catch (e) {}
    return '';
  };

  // element → learned checkbox/radio group, so the live recorder can find and
  // force-save the group a just-clicked box belongs to.
  const cbGroupByEl = new Map();
  const radioGroupByEl = new Map();
  // Every learned combobox input, so a menu-option click (which fires no
  // change event on the input) can trigger a re-read of all of them.
  const comboboxEls = new Set();

  // Watch a custom (learned) field: any committed value the user enters is
  // saved to the backend so the next autofill can reuse it. Hoisted out of the
  // discovery pass so the live recorder can hook fields discovered later.
  const attachCustomFieldListener = (el, sig) => {
    if (el.__vegaListenerAttached) return;
    el.__vegaListenerAttached = true;

    const sendSaveValue = (value) => {
      if (value == null || value === '') return;
      if (el.__vegaLastSaved === value) return; // avoid duplicate logs/saves
      el.__vegaLastSaved = value;
      let pageUrl = '';
      try { pageUrl = location.href; } catch (e) {}
      try {
        chrome.runtime.sendMessage({
          type: 'vegaSaveFieldValue',
          field: { fieldKey: sig.fieldKey, label: sig.label, fieldType: sig.fieldType, options: sig.options, value, lastSeenUrl: pageUrl }
        }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok) {
            if (resp.firstAnswer) {
              // A brand-new field has just been recorded in the DB with your info.
              vegaLog(`🆕 New field recorded in your profile/DB: "${trunc(sig.label)}" = "${trunc(value)}"`);
              vegaNotify(`Saved a new answer to your Vega profile: "${trunc(sig.label)}"`);
            } else {
              vegaLog(`✎ Updated saved answer: "${trunc(sig.label)}" = "${trunc(value)}"`);
            }
          } else {
            vegaLog(`⚠ Could not save "${trunc(sig.label)}": ${resp && resp.error ? resp.error : 'no response'}`);
          }
        });
      } catch (e) { /* extension context may be gone */ }
    };

    const handler = () => {
      const value = readFieldValue(el);
      if ((value == null || value === '') && isComboboxEl(el)) {
        // react-select clears the input after a pick and renders the chosen
        // label elsewhere, updating asynchronously — read it shortly after.
        setTimeout(() => { const v = readComboboxSelection(el); if (v) sendSaveValue(v); }, 350);
        return;
      }
      sendSaveValue(value);
    };
    // `change` covers native <select> and inputs; `blur` and a delayed `input`
    // re-read cover combobox widgets that commit a selection asynchronously.
    el.addEventListener('change', handler);
    el.addEventListener('blur', handler);
    if (isComboboxEl(el)) {
      el.addEventListener('input', () => setTimeout(handler, 350));
      el.__vegaComboRead = handler;
      comboboxEls.add(el);
    }
  };

  const discoverAndLearnCustomFields = () => {
    let pageUrl = '';
    try { pageUrl = location.href; } catch (e) {}

    const candidates = queryAllIncludingShadows('input, textarea, select');
    const sigByElement = new Map();   // element -> signature
    const elementsByKey = new Map();  // fieldKey -> [elements]
    const seen = new Map();           // fieldKey -> signature (dedup for payload)

    candidates.forEach(el => {
      if (matchedElements.has(el)) return;
      if (el.disabled || el.readOnly) return;
      if (el.tagName === 'INPUT' && SKIP_TYPES.has((el.type || '').toLowerCase())) return;
      // Ignore zero-size / hidden fields.
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
      } catch (e) {}

      const sig = buildFieldSignature(el);
      if (!sig) return;

      sigByElement.set(el, sig);
      if (!elementsByKey.has(sig.fieldKey)) elementsByKey.set(sig.fieldKey, []);
      elementsByKey.get(sig.fieldKey).push(el);
      if (!seen.has(sig.fieldKey)) seen.set(sig.fieldKey, { ...sig, lastSeenUrl: pageUrl });
    });

    const discovered = Array.from(seen.values());
    if (discovered.length === 0) {
      console.log('Vega: no custom fields discovered on this page.');
      return;
    }
    vegaLog(`🔍 Scanned page: ${discovered.length} custom question(s) found — checking your saved answers…`);

    // Attach listeners so user edits are remembered, regardless of backend state.
    sigByElement.forEach((sig, el) => attachCustomFieldListener(el, sig));

    // Sync with backend: record new fields, retrieve saved answers.
    try {
      chrome.runtime.sendMessage({ type: 'vegaDiscoverFields', fields: discovered }, (resp) => {
        if (!resp || !resp.ok) {
          vegaLog(`⚠ Custom-field sync failed: ${resp && resp.error ? resp.error : 'no response from background'}`);
          return;
        }
        const savedFields = Array.isArray(resp.fields) ? resp.fields : [];
        const createdKeys = new Set(resp.createdKeys || []);

        // Report brand-new questions that were just recorded to the profile/DB.
        if (createdKeys.size > 0) {
          discovered.forEach(d => {
            if (createdKeys.has(d.fieldKey)) {
              vegaLog(`🆕 New field saved to your profile (needs an answer): "${trunc(d.label)}"`);
            }
          });
        }

        let learnedFilled = 0;
        savedFields.forEach(saved => {
          if (saved.value == null || saved.value === '') return;
          const els = elementsByKey.get(saved.fieldKey);
          if (!els) return;
          els.forEach(el => {
            if (isComboboxEl(el)) {
              // Combobox/react-select: type the saved label and pick the option.
              el.__vegaLastSaved = saved.value; // pre-set so the resulting change isn't re-saved
              enqueueFill(() => {
                if ((el.value || '').trim() || readComboboxSelection(el)) return; // user got there first
                return selectFromTypeahead(el, saved.value); // holds the queue until picked
              });
            } else if (setCustomValue(el, saved.value)) {
              learnedFilled++;
              filledCount++;
              highlight(el);
              el.__vegaLastSaved = saved.value; // don't re-log this as a user change
              vegaLog(`✓ Filled remembered field "${trunc(saved.label)}" → "${trunc(saved.value)}"`);
            }
          });
        });
        if (learnedFilled === 0 && createdKeys.size === 0) {
          vegaLog('• No remembered answers matched and no new fields to add.');
        }
      });
    } catch (e) {
      console.warn('Vega: could not send discovered fields:', e);
    }
  };

  // ── Checkbox learning ───────────────────────────────────────────────────────
  // Checkboxes are skipped by the text/select learning above (they're in
  // SKIP_TYPES). Here we learn them as their own custom fields and reuse the
  // same backend so answers are remembered across sites:
  //   • a single consent-style checkbox  → one field whose answer is its label
  //     when checked (empty when unchecked);
  //   • a "select all that apply" group (several checkboxes sharing a question)
  //     → one field whose answer is the set of chosen option labels.
  // As with every custom field, the answer is synced to the backend and any
  // edit the user makes on the page is saved back for next time.
  const VEGA_CB_DELIM = ' | ';
  const cbClean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  // The label for a single checkbox (its own option text).
  const getCheckboxLabel = (cb) => {
    try {
      if (cb.id) {
        const lbl = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
        if (lbl && cbClean(lbl.textContent)) return cbClean(lbl.textContent);
      }
      const wrap = cb.closest('label');
      if (wrap) {
        const clone = wrap.cloneNode(true);
        clone.querySelectorAll('input, textarea, select, button').forEach(n => n.remove());
        if (cbClean(clone.textContent)) return cbClean(clone.textContent);
      }
      const aria = cbClean(cb.getAttribute('aria-label'));
      if (aria) return aria;
      // Lever and similar render the label as text following the input.
      let sib = cb.nextSibling;
      let hops = 0;
      while (sib && hops < 4) {
        if (cbClean(sib.textContent)) return cbClean(sib.textContent);
        sib = sib.nextSibling; hops++;
      }
      const val = cbClean(cb.value);
      if (val && normalizeString(val) !== 'on') return val;
    } catch (e) {}
    return '';
  };

  const findCommonAncestor = (els) => {
    let anc = els[0] ? els[0].parentElement : null;
    while (anc && !els.every(e => anc.contains(e))) anc = anc.parentElement;
    return anc;
  };

  // The shared question for a multi-checkbox group — a legend/label/heading that
  // wraps the group but isn't one of the individual option labels.
  const getCheckboxGroupQuestion = (boxes, optionLabels) => {
    const normOpts = new Set(optionLabels.map(normalizeString));
    const fs = boxes[0].closest('fieldset');
    if (fs && boxes.every(b => fs.contains(b))) {
      const lg = fs.querySelector('legend');
      if (lg && cbClean(lg.textContent)) return cbClean(lg.textContent);
    }
    let anc = findCommonAncestor(boxes);
    let depth = 0;
    while (anc && depth < 5) {
      const cands = anc.querySelectorAll('label, legend, [class*="question" i], [class*="label" i], h1, h2, h3, h4, h5, h6, p');
      for (const c of cands) {
        if (boxes.some(b => c.contains(b))) continue; // skip the option labels themselves
        const clone = c.cloneNode(true);
        clone.querySelectorAll('input, textarea, select, button').forEach(n => n.remove());
        const txt = cbClean(clone.textContent);
        if (txt && txt.length >= 2 && txt.length <= 400 && !normOpts.has(normalizeString(txt))) {
          return txt;
        }
      }
      anc = anc.parentElement; depth++;
    }
    return '';
  };

  const discoverAndLearnCheckboxes = () => {
    let pageUrl = '';
    try { pageUrl = location.href; } catch (e) {}

    const allCb = queryAllIncludingShadows('input[type="checkbox"]').filter(cb => {
      if (matchedElements.has(cb)) return false;
      if (cb.disabled) return false;
      try { const r = cb.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false; } catch (e) {}
      return true;
    });
    if (allCb.length === 0) return;

    // Group checkboxes: those sharing a `name` (Lever uses cards[uuid][fieldN])
    // are one "select all that apply" question; a legend-bearing fieldset also
    // forms a group; everything else is a standalone consent-style checkbox.
    const groupMap = new Map(); // groupId -> [checkboxes]
    let soloCounter = 0;
    allCb.forEach(cb => {
      const name = (cb.getAttribute('name') || '').replace(/\[\]$/, '').trim();
      let groupId;
      if (name) {
        groupId = 'name:' + name;
      } else {
        const fs = cb.closest('fieldset');
        if (fs && fs.querySelector('legend')) {
          if (!fs.__vegaGid) fs.__vegaGid = 'fs' + (++soloCounter);
          groupId = fs.__vegaGid;
        } else {
          groupId = 'solo:' + (++soloCounter);
        }
      }
      if (!groupMap.has(groupId)) groupMap.set(groupId, []);
      groupMap.get(groupId).push(cb);
    });

    const groups = [];          // { fieldKey, label, options, boxes:[{el,optLabel}], ... }
    const groupByKey = new Map();
    groupMap.forEach(boxes => {
      const labeled = boxes
        .map(el => ({ el, optLabel: getCheckboxLabel(el) }))
        .filter(b => b.optLabel);
      if (labeled.length === 0) return;

      const opts = labeled.map(b => b.optLabel);
      const question = labeled.length > 1
        ? (getCheckboxGroupQuestion(labeled.map(b => b.el), opts) || opts.join(' / '))
        : opts[0];
      if (!question || question.length < 2 || question.length > 400) return;

      const fieldKey = normalizeString(question).slice(0, 300);
      if (!fieldKey) return;

      const grp = { fieldKey, label: question, options: opts, boxes: labeled, __lastSaved: null, __filling: false };
      labeled.forEach(b => matchedElements.add(b.el));
      groups.push(grp);
      if (!groupByKey.has(fieldKey)) groupByKey.set(fieldKey, grp);
    });
    if (groups.length === 0) return;

    const currentSelection = (grp) =>
      grp.boxes.filter(b => b.el.checked).map(b => b.optLabel).join(VEGA_CB_DELIM);

    // Persist the group's current selection. Empty selections are saved too, so
    // un-checking everything is remembered as a deliberate answer change.
    const saveGroup = (grp) => {
      if (grp.__filling) return;
      const value = currentSelection(grp);
      if (grp.__lastSaved === value) return;
      grp.__lastSaved = value;
      try {
        chrome.runtime.sendMessage({
          type: 'vegaSaveFieldValue',
          field: { fieldKey: grp.fieldKey, label: grp.label, fieldType: 'checkbox', options: grp.options, value, lastSeenUrl: pageUrl }
        }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok) {
            if (value === '') {
              vegaLog(`✎ Cleared saved answer: "${trunc(grp.label)}"`);
            } else if (resp.firstAnswer) {
              vegaLog(`🆕 New checkbox field recorded in your profile/DB: "${trunc(grp.label)}" = "${trunc(value)}"`);
              vegaNotify(`Saved a new answer to your Vega profile: "${trunc(grp.label)}"`);
            } else {
              vegaLog(`✎ Updated saved answer: "${trunc(grp.label)}" = "${trunc(value)}"`);
            }
          } else {
            vegaLog(`⚠ Could not save "${trunc(grp.label)}": ${resp && resp.error ? resp.error : 'no response'}`);
          }
        });
      } catch (e) { /* extension context may be gone */ }
    };

    // Remember edits to any checkbox in the group.
    groups.forEach(grp => {
      grp.__lastSaved = currentSelection(grp);
      grp.__save = () => saveGroup(grp);
      grp.boxes.forEach(({ el }) => {
        cbGroupByEl.set(el, grp);
        if (el.__vegaCbListener) return;
        el.__vegaCbListener = true;
        el.addEventListener('change', () => saveGroup(grp));
      });
    });

    const discovered = groups.map(g => ({
      fieldKey: g.fieldKey, label: g.label, fieldType: 'checkbox', options: g.options, lastSeenUrl: pageUrl
    }));
    vegaLog(`🔍 Scanned page: ${discovered.length} checkbox question(s) found — checking your saved answers…`);

    try {
      chrome.runtime.sendMessage({ type: 'vegaDiscoverFields', fields: discovered }, (resp) => {
        if (!resp || !resp.ok) {
          vegaLog(`⚠ Checkbox sync failed: ${resp && resp.error ? resp.error : 'no response from background'}`);
          return;
        }
        const savedFields = Array.isArray(resp.fields) ? resp.fields : [];
        const createdKeys = new Set(resp.createdKeys || []);
        discovered.forEach(d => {
          if (createdKeys.has(d.fieldKey)) {
            vegaLog(`🆕 New checkbox field saved to your profile (needs an answer): "${trunc(d.label)}"`);
          }
        });

        savedFields.forEach(saved => {
          if (saved.value == null || saved.value === '') return;
          const grp = groupByKey.get(saved.fieldKey);
          if (!grp) return;
          const wanted = new Set(String(saved.value).split('|').map(s => normalizeString(s)).filter(Boolean));
          enqueueFill(() => {
            if (currentSelection(grp) !== '') return; // user touched the group during the stagger
            grp.__filling = true; // suppress the change listener while we apply
            let changed = false;
            grp.boxes.forEach(({ el, optLabel }) => {
              const want = wanted.has(normalizeString(optLabel));
              if (el.checked !== want) {
                el.checked = want;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                changed = true;
              }
            });
            grp.__lastSaved = currentSelection(grp);
            grp.__filling = false;
            if (changed) {
              filledCount++;
              highlight((grp.boxes[0].el.closest('label, fieldset, div')) || grp.boxes[0].el);
              vegaLog(`✓ Filled remembered checkbox "${trunc(saved.label)}" → "${trunc(saved.value)}"`);
            }
          });
        });
      });
    } catch (e) {
      console.warn('Vega: could not send discovered checkboxes:', e);
    }
  };

  // ── Radio-group learning ────────────────────────────────────────────────────
  // Radio groups the standard pass didn't handle (it only knows EEO-style
  // questions) are learned like checkbox groups: one field per question whose
  // answer is the selected option's label. A saved answer re-selects the same
  // option next time, and any change the user makes is written back.
  const discoverAndLearnRadios = () => {
    let pageUrl = '';
    try { pageUrl = location.href; } catch (e) {}

    const allRadios = queryAllIncludingShadows('input[type="radio"]').filter(r => {
      if (matchedElements.has(r)) return false;
      if (r.disabled) return false;
      try { const b = r.getBoundingClientRect(); if (b.width === 0 && b.height === 0) return false; } catch (e) {}
      return true;
    });
    if (allRadios.length === 0) return;

    const groupMap = new Map();
    let soloCounter = 0;
    allRadios.forEach(r => {
      const name = (r.getAttribute('name') || '').trim();
      let groupId;
      if (name) {
        groupId = 'name:' + name;
      } else {
        const fs = r.closest('fieldset');
        if (fs && fs.querySelector('legend')) {
          if (!fs.__vegaRadioGid) fs.__vegaRadioGid = 'rfs' + (++soloCounter);
          groupId = fs.__vegaRadioGid;
        } else {
          groupId = 'rsolo:' + (++soloCounter);
        }
      }
      if (!groupMap.has(groupId)) groupMap.set(groupId, []);
      groupMap.get(groupId).push(r);
    });

    const groups = [];
    const groupByKey = new Map();
    groupMap.forEach(boxes => {
      const labeled = boxes
        .map(el => ({ el, optLabel: getCheckboxLabel(el) }))
        .filter(b => b.optLabel);
      if (labeled.length === 0) return;
      const opts = labeled.map(b => b.optLabel);
      const question = getCheckboxGroupQuestion(labeled.map(b => b.el), opts) || opts.join(' / ');
      if (!question || question.length < 2 || question.length > 400) return;
      const fieldKey = normalizeString(question).slice(0, 300);
      if (!fieldKey) return;
      const grp = { fieldKey, label: question, options: opts, boxes: labeled, __lastSaved: null, __filling: false };
      labeled.forEach(b => matchedElements.add(b.el));
      groups.push(grp);
      if (!groupByKey.has(fieldKey)) groupByKey.set(fieldKey, grp);
    });
    if (groups.length === 0) return;

    const currentSelection = (grp) => {
      const sel = grp.boxes.find(b => b.el.checked);
      return sel ? sel.optLabel : '';
    };

    const saveGroup = (grp) => {
      if (grp.__filling) return;
      const value = currentSelection(grp);
      if (grp.__lastSaved === value) return;
      grp.__lastSaved = value;
      try {
        chrome.runtime.sendMessage({
          type: 'vegaSaveFieldValue',
          field: { fieldKey: grp.fieldKey, label: grp.label, fieldType: 'radio', options: grp.options, value, lastSeenUrl: pageUrl }
        }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok) {
            if (resp.firstAnswer) {
              vegaLog(`🆕 New multiple-choice answer recorded: "${trunc(grp.label)}" = "${trunc(value)}"`);
              vegaNotify(`Saved a new answer to your Vega profile: "${trunc(grp.label)}"`);
            } else {
              vegaLog(`✎ Updated saved answer: "${trunc(grp.label)}" = "${trunc(value)}"`);
            }
          } else {
            vegaLog(`⚠ Could not save "${trunc(grp.label)}": ${resp && resp.error ? resp.error : 'no response'}`);
          }
        });
      } catch (e) { /* extension context may be gone */ }
    };

    // Remember edits to any radio in the group.
    groups.forEach(grp => {
      grp.__lastSaved = currentSelection(grp);
      grp.__save = () => saveGroup(grp);
      grp.boxes.forEach(({ el }) => {
        radioGroupByEl.set(el, grp);
        if (el.__vegaRadioListener) return;
        el.__vegaRadioListener = true;
        el.addEventListener('change', () => saveGroup(grp));
      });
    });

    const discovered = groups.map(g => ({
      fieldKey: g.fieldKey, label: g.label, fieldType: 'radio', options: g.options, lastSeenUrl: pageUrl
    }));
    vegaLog(`🔍 Scanned page: ${discovered.length} multiple-choice question(s) found — checking your saved answers…`);

    try {
      chrome.runtime.sendMessage({ type: 'vegaDiscoverFields', fields: discovered }, (resp) => {
        if (!resp || !resp.ok) {
          vegaLog(`⚠ Multiple-choice sync failed: ${resp && resp.error ? resp.error : 'no response from background'}`);
          return;
        }
        const savedFields = Array.isArray(resp.fields) ? resp.fields : [];
        const createdKeys = new Set(resp.createdKeys || []);
        discovered.forEach(d => {
          if (createdKeys.has(d.fieldKey)) {
            vegaLog(`🆕 New multiple-choice question saved to your profile (needs an answer): "${trunc(d.label)}"`);
          }
        });

        savedFields.forEach(saved => {
          if (saved.value == null || saved.value === '') return;
          const grp = groupByKey.get(saved.fieldKey);
          if (!grp) return;
          const want = normalizeString(String(saved.value));
          const target = grp.boxes.find(b => normalizeString(b.optLabel) === want)
            || grp.boxes.find(b => normalizeString(b.optLabel).includes(want) || want.includes(normalizeString(b.optLabel)));
          if (!target || target.el.checked) return;
          enqueueFill(() => {
            if (grp.boxes.some(b => b.el.checked)) return; // user picked during the stagger
            grp.__filling = true;
            target.el.checked = true;
            target.el.dispatchEvent(new Event('input', { bubbles: true }));
            target.el.dispatchEvent(new Event('change', { bubbles: true }));
            target.el.dispatchEvent(new Event('click', { bubbles: true }));
            grp.__lastSaved = currentSelection(grp);
            grp.__filling = false;
            filledCount++;
            highlight(target.el.closest('label') || target.el);
            vegaLog(`✓ Selected remembered answer "${trunc(saved.value)}" for "${trunc(saved.label)}"`);
          });
        });
      });
    } catch (e) {
      console.warn('Vega: could not send discovered radios:', e);
    }
  };

  // ── Button-group (segmented control) learning ───────────────────────────────
  // Some ATSs (Ashby) render Yes/No questions as styled <button>s, not radio
  // inputs — clicks fire no change events and no form control holds the answer.
  // Groups of 2–6 short-labeled sibling buttons under an identifiable question
  // are learned as one field; the clicked option's label is the answer, and a
  // saved answer is re-applied by clicking the exact-matching option. Buttons
  // with action-like labels (Submit, Next, …) are never learned or clicked.
  const BUTTON_ACTION_RE = /submit|apply|send|next|back|cancel|upload|attach|save|continue|clear|remove|delete|close|search|sign ?up|log ?in|edit|view|show|hide|more/i;
  const btnGroupByEl = new Map();

  const getButtonOptionLabel = (btn) => {
    const t = cbClean(btn.textContent);
    if (!t || t.length > 40) return '';
    if (BUTTON_ACTION_RE.test(t)) return '';
    return t;
  };

  const isButtonActive = (btn) => {
    if (btn.getAttribute('aria-pressed') === 'true' || btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('aria-selected') === 'true') return true;
    return /(^|[_\s-])(active|selected|checked)/i.test(typeof btn.className === 'string' ? btn.className : '');
  };

  const discoverAndLearnButtonGroups = () => {
    let pageUrl = '';
    try { pageUrl = location.href; } catch (e) {}

    const buttons = queryAllIncludingShadows('button').filter(btn => {
      if (matchedElements.has(btn)) return false;
      if (btn.disabled) return false;
      if (!getButtonOptionLabel(btn)) return false;
      try { const r = btn.getBoundingClientRect(); if (r.width === 0 && r.height === 0) return false; } catch (e) {}
      return true;
    });
    if (!buttons.length) return;

    // Group by direct parent; only clusters of 2–6 option-like buttons qualify.
    const byParent = new Map();
    buttons.forEach(btn => {
      const p = btn.parentElement;
      if (!p) return;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(btn);
    });

    const groups = [];
    const groupByKey = new Map();
    byParent.forEach(btns => {
      if (btns.length < 2 || btns.length > 6) return;
      const labeled = btns.map(el => ({ el, optLabel: getButtonOptionLabel(el) }));
      const opts = labeled.map(b => b.optLabel);
      // Without a findable question this is more likely a toolbar than a form
      // answer — too risky to learn (and to click on refill).
      const question = getCheckboxGroupQuestion(labeled.map(b => b.el), opts);
      if (!question || question.length < 2 || question.length > 400) return;
      const fieldKey = normalizeString(question).slice(0, 300);
      if (!fieldKey) return;
      const grp = { fieldKey, label: question, options: opts, boxes: labeled, __lastSaved: null, __filling: false };
      labeled.forEach(b => matchedElements.add(b.el));
      groups.push(grp);
      if (!groupByKey.has(fieldKey)) groupByKey.set(fieldKey, grp);
    });
    if (!groups.length) return;

    const currentSelection = (grp) => {
      const sel = grp.boxes.find(b => isButtonActive(b.el));
      return sel ? sel.optLabel : '';
    };

    const saveGroup = (grp, value) => {
      if (grp.__filling) return;
      if (value == null || value === '') return;
      if (grp.__lastSaved === value) return;
      grp.__lastSaved = value;
      try {
        chrome.runtime.sendMessage({
          type: 'vegaSaveFieldValue',
          field: { fieldKey: grp.fieldKey, label: grp.label, fieldType: 'buttongroup', options: grp.options, value, lastSeenUrl: pageUrl }
        }, (resp) => {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok) {
            if (resp.firstAnswer) {
              vegaLog(`🆕 New answer recorded: "${trunc(grp.label)}" = "${trunc(value)}"`);
              vegaNotify(`Saved a new answer to your Vega profile: "${trunc(grp.label)}"`);
            } else {
              vegaLog(`✎ Updated saved answer: "${trunc(grp.label)}" = "${trunc(value)}"`);
            }
          } else {
            vegaLog(`⚠ Could not save "${trunc(grp.label)}": ${resp && resp.error ? resp.error : 'no response'}`);
          }
        });
      } catch (e) { /* extension context may be gone */ }
    };

    groups.forEach(grp => {
      grp.__lastSaved = currentSelection(grp);
      grp.__save = (value) => saveGroup(grp, value);
      grp.boxes.forEach(({ el, optLabel }) => {
        btnGroupByEl.set(el, grp);
        if (el.__vegaBtnListener) return;
        el.__vegaBtnListener = true;
        el.addEventListener('click', (e) => { if (e.isTrusted) saveGroup(grp, optLabel); });
      });
    });

    const discovered = groups.map(g => ({
      fieldKey: g.fieldKey, label: g.label, fieldType: 'buttongroup', options: g.options, lastSeenUrl: pageUrl
    }));
    vegaLog(`🔍 Scanned page: ${discovered.length} button question(s) found — checking your saved answers…`);

    try {
      chrome.runtime.sendMessage({ type: 'vegaDiscoverFields', fields: discovered }, (resp) => {
        if (!resp || !resp.ok) {
          vegaLog(`⚠ Button-question sync failed: ${resp && resp.error ? resp.error : 'no response from background'}`);
          return;
        }
        const savedFields = Array.isArray(resp.fields) ? resp.fields : [];
        const createdKeys = new Set(resp.createdKeys || []);
        discovered.forEach(d => {
          if (createdKeys.has(d.fieldKey)) {
            vegaLog(`🆕 New button question saved to your profile (needs an answer): "${trunc(d.label)}"`);
          }
        });

        savedFields.forEach(saved => {
          if (saved.value == null || saved.value === '') return;
          const grp = groupByKey.get(saved.fieldKey);
          if (!grp) return;
          const want = normalizeString(String(saved.value));
          // Exact label match only — never click a button we're unsure about.
          const target = grp.boxes.find(b => normalizeString(b.optLabel) === want);
          if (!target || isButtonActive(target.el)) return;
          enqueueFill(() => {
            if (currentSelection(grp) !== '') return; // user picked during the stagger
            grp.__filling = true;
            try { target.el.click(); } catch (e) {}
            grp.__filling = false;
            grp.__lastSaved = String(saved.value);
            filledCount++;
            highlight(target.el);
            vegaLog(`✓ Selected remembered answer "${trunc(saved.value)}" for "${trunc(saved.label)}"`);
          });
        });
      });
    } catch (e) {
      console.warn('Vega: could not send discovered button groups:', e);
    }
  };

  // ── Always-on field recorder ────────────────────────────────────────────────
  // Fields can appear after the initial pass (conditional questions, framework
  // re-renders) and users interact with fields no pass matched. Two safety
  // nets: a MutationObserver learns/fills fields as they appear, and a
  // document-level change listener hooks any still-unwatched field the moment
  // the user commits a value in it, so the value is saved to the profile/DB
  // and reused by the next autofill.
  let dynamicWatcherStarted = false;
  const startDynamicFieldWatcher = () => {
    if (dynamicWatcherStarted) return;
    dynamicWatcherStarted = true;

    let rescanTimer = null;
    const scheduleRescan = () => {
      if (rescanTimer) return;
      rescanTimer = setTimeout(() => {
        rescanTimer = null;
        fillTextAndFormFields();
        discoverAndLearnCustomFields();
        discoverAndLearnCheckboxes();
        discoverAndLearnRadios();
        discoverAndLearnButtonGroups();
      }, 600);
    };

    try {
      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if ((node.matches && node.matches('input, textarea, select')) ||
                (node.querySelector && node.querySelector('input, textarea, select'))) {
              scheduleRescan();
              return;
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }

    document.addEventListener('change', (e) => {
      // Only real user actions — our own fills dispatch untrusted events.
      if (!e.isTrusted) return;
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      if (el.__vegaStdListener || el.__vegaListenerAttached || el.__vegaCbListener || el.__vegaRadioListener) return;
      const type = el instanceof HTMLInputElement ? (el.type || 'text').toLowerCase() : '';

      if (type === 'checkbox' || type === 'radio') {
        // Learn the group now, then persist the selection that caused this event.
        discoverAndLearnCheckboxes();
        discoverAndLearnRadios();
        const grp = cbGroupByEl.get(el) || radioGroupByEl.get(el);
        if (grp && grp.__save) { grp.__lastSaved = null; grp.__save(); }
        return;
      }
      if (SKIP_TYPES.has(type)) return;

      // Standard profile field the initial pass missed? Text inputs only —
      // a select whose label merely mentions "country" (e.g. "Do you require
      // sponsorship … in the country …") must not patch the profile with its
      // picked option; selects and textareas are remembered as custom fields.
      let bestKey = null;
      let bestScore = 30;
      if (el instanceof HTMLInputElement) {
        for (const fieldKey of Object.keys(fieldKeywords)) {
          const score = getScoreForField(el, fieldKey);
          if (score > bestScore) { bestScore = score; bestKey = fieldKey; }
        }
      }
      // Listeners attached to the target during the document capture phase
      // still run for this same event, so the committed value is saved now.
      if (bestKey && SYNCABLE_KEYS.has(bestKey)) {
        attachStandardSync(el, bestKey);
        el.__vegaStdLast = ''; // force the just-attached handler to treat this value as new
      } else {
        const sig = buildFieldSignature(el);
        if (sig) attachCustomFieldListener(el, sig);
      }
    }, true);

    // Clicks on option-style buttons (Ashby-style Yes/No) that no pass has
    // learned yet: learn the group now and persist the clicked option.
    document.addEventListener('click', (e) => {
      if (!e.isTrusted) return;

      // A mouse pick in a combobox menu (react-select et al.) commits the
      // value without firing change/input on the combobox's input — re-read
      // every learned combobox shortly after any menu-option click.
      const optEl = e.target && e.target.closest
        ? e.target.closest('[role="option"], [id*="-option-"]')
        : null;
      if (optEl) {
        setTimeout(() => {
          comboboxEls.forEach(ce => {
            try { if (ce.isConnected && ce.__vegaComboRead) ce.__vegaComboRead(); } catch (err) { /* ignore */ }
          });
        }, 350);
      }

      const btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn || btn.__vegaBtnListener) return;
      const label = getButtonOptionLabel(btn);
      if (!label) return;
      discoverAndLearnButtonGroups();
      const grp = btnGroupByEl.get(btn);
      if (grp && grp.__save) { grp.__lastSaved = null; grp.__save(label); }
    }, true);
  };



  const runAllFillPasses = (opts = {}) => {
    fillTextAndFormFields(opts);
    discoverAndLearnCustomFields();
    discoverAndLearnCheckboxes();
    discoverAndLearnRadios();
    discoverAndLearnButtonGroups();
    startDynamicFieldWatcher();
    showToast();
  };

  // Ashby, Greenhouse and similar ATSs parse an uploaded resume server-side
  // and then re-render the form with values extracted from it — seconds after
  // the upload. Filling on a fixed delay races that parse and loses. Instead,
  // wait until the page goes quiet: no DOM mutations and no synthetic
  // input/change events for `quiet` ms (after `minWait`, capped at `maxWait`).
  const waitForFormSettle = (onSettled, { minWait = 4000, quiet = 2500, maxWait = 25000 } = {}) => {
    const start = Date.now();
    let lastActivity = Date.now();
    let done = false;

    const bump = () => { lastActivity = Date.now(); };
    const observer = new MutationObserver(bump);
    try {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    } catch (e) { /* body may be missing in exotic pages */ }
    document.addEventListener('input', bump, true);
    document.addEventListener('change', bump, true);

    const finish = (reason) => {
      if (done) return;
      done = true;
      try { observer.disconnect(); } catch (e) {}
      document.removeEventListener('input', bump, true);
      document.removeEventListener('change', bump, true);
      console.log(`Vega: form settled (${reason}) after ${Date.now() - start}ms — filling now.`);
      onSettled();
    };

    const tick = () => {
      if (done) return;
      const now = Date.now();
      if (now - start >= maxWait) return finish('max wait reached');
      if (now - start >= minWait && now - lastActivity >= quiet) return finish('page went quiet');
      setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
  };

  // Safety net for parses slower than the settle window: watch the standard
  // fields we filled and, if the page overwrites one (values changed but not
  // by a trusted user edit), put the profile value back — once per field. If a
  // re-render replaced the nodes entirely, run one corrective fill pass.
  const armLateParseGuard = (durationMs = 12000) => {
    if (!standardFills.length) return;
    const deadline = Date.now() + durationMs;
    let refillDone = false;
    const iv = setInterval(() => {
      if (Date.now() > deadline) { clearInterval(iv); return; }
      standardFills.forEach(f => {
        const { el, value } = f;
        if (f.restored || el.__vegaUserEdited) return;
        if (document.activeElement === el) return;
        try {
          if (!el.isConnected) {
            if (!refillDone) {
              refillDone = true;
              console.log('Vega: form re-rendered after fill — running a corrective pass.');
              fillTextAndFormFields({ overwriteStandard: true });
            }
            f.restored = true; // node is gone; nothing more to watch here
            return;
          }
          const cur = (el.value || '').trim();
          if (cur !== value) {
            f.restored = true;
            el.__vegaStdLast = value;
            setNativeValue(el, value);
            highlight(el);
            vegaLog(`↻ The page changed a field after autofill — restored your profile value "${trunc(value)}"`);
          }
        } catch (e) { /* ignore */ }
      });
    }, 500);
  };

  // 5. Resume upload — runs first; the profile fill waits for the ATS's
  // resume-parse to finish so it isn't overwritten by it.
  if (chrome && chrome.storage && chrome.storage.local) {
    console.log("Vega: Retrieving resume from local storage...");
    chrome.storage.local.get(['resumeData', 'resumeFileName', 'resumeMime'], (result) => {
      if (!result.resumeData || !result.resumeFileName) {
        console.log("Vega: No resume found in storage. Filling text fields only.");
        runAllFillPasses();
        return;
      }
      
      console.log(`Vega: Found resume in storage: ${result.resumeFileName} (size: ${result.resumeData.length} chars)`);
      const arr = result.resumeData.split(',');
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const file = new File([u8arr], result.resumeFileName, { type: result.resumeMime || 'application/pdf' });

      // Expanded keyword dictionary for resume uploading (English & Spanish)
      const RESUME_KEYWORDS = ['resume', 'cv', 'curriculum', 'attach', 'upload your', 'upload file', 'curriculum vitae', 'hoja de vida', 'adjuntar', 'cargar', 'seleccionar', 'archivo', 'documento'];
      const fileInputs = queryAllIncludingShadows('input[type="file"]');
      let injected = 0;
      
      console.log(`Vega: Found ${fileInputs.length} file inputs on the page.`);
      
      fileInputs.forEach(fileInput => {
        const accept = (fileInput.getAttribute('accept') || '').toLowerCase();
        const text = getFieldText(fileInput);
        const normText = normalizeString(text);
        const labelMatch = RESUME_KEYWORDS.some(kw => normText.includes(normalizeString(kw)));
        const isOnlyFileInput = fileInputs.length === 1;

        console.log(`Vega: Evaluating file input. ID: "${fileInput.id}", Name: "${fileInput.name}", Accept: "${accept}", Label Text: "${text}", Label Match: ${labelMatch}, Is Only File Input: ${isOnlyFileInput}`);

        if (fileInput.disabled) {
          console.log(`Vega: Skipping file input because it is disabled`);
          return;
        }
        if (accept && !/(pdf|doc|word|application|\*)/.test(accept)) {
          console.log(`Vega: Skipping file input because accept attribute does not allow documents: "${accept}"`);
          return;
        }

        const isCoverLetter = normText.includes('cover') || normText.includes('letter') || normText.includes('carta') || normText.includes('presentacion');
        if (isCoverLetter && !normText.includes('cv') && !normText.includes('resume') && !normText.includes('curriculum')) {
           console.log("Vega: Skipping file input because it looks like a cover letter:", fileInput);
           return;
        }

        if (labelMatch || isOnlyFileInput) {
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            injected++;
            highlight(fileInput.closest('label, div, section') || fileInput);
            vegaLog(`✓ Attached resume "${trunc(result.resumeFileName)}" to the upload field`);
            console.log(`Vega: Successfully injected resume into:`, fileInput);
          } catch (e) {
            console.warn("Vega: Resume injection failed for input:", e);
          }
        }
      });

      // Fallback: if no input matched by label (e.g. SmartRecruiters hidden dropzone inputs),
      // inject into the first non-cover-letter, non-disabled file input.
      if (injected === 0 && fileInputs.length > 0) {
        const fallbackInput = fileInputs.find(fi => {
          if (fi.disabled) return false;
          const accept = (fi.getAttribute('accept') || '').toLowerCase();
          if (accept && !/(pdf|doc|word|application|\*)/.test(accept)) return false;
          const normText = normalizeString(getFieldText(fi));
          const isCoverLetter = normText.includes('cover') || normText.includes('letter') || normText.includes('carta') || normText.includes('presentacion');
          return !isCoverLetter;
        });
        if (fallbackInput) {
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            fallbackInput.files = dt.files;
            fallbackInput.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            injected++;
            highlight(fallbackInput.closest('label, div, section') || fallbackInput);
            vegaLog(`✓ Attached resume "${trunc(result.resumeFileName)}" to the upload field`);
            console.log(`Vega: Fallback resume injection into:`, fallbackInput);
          } catch (e) {
            console.warn("Vega: Fallback resume injection failed:", e);
          }
        } else {
          console.log("Vega: found file inputs but none matched resume heuristics");
        }
      }

      if (injected > 0) {
        // The upload triggers the ATS's resume parse, which re-renders the
        // form with parsed values. Wait for that to finish, then fill from the
        // profile letting it overwrite parse results, and keep a guard armed
        // in case an extra-slow parse lands even later.
        vegaLog('⏳ Resume attached — waiting for the page to process it before filling your details…');
        waitForFormSettle(() => {
          runAllFillPasses({ overwriteStandard: true });
          armLateParseGuard();
        });
      } else {
        // Nothing was uploaded, so no parse is coming — fill after a short
        // delay for any rendering triggered by the attempt.
        setTimeout(() => runAllFillPasses(), 500);
      }
    });
  } else {
    // No resume storage — fill text fields immediately
    runAllFillPasses();
  }

  function showToast() {
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
  }
};
