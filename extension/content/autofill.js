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
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

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
      partial: ['portfolio', 'website', 'sitio', 'url']
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

      // Traverse up to 3 levels of parents to collect dropzone / form group label texts
      let current = el.parentElement;
      let depth = 0;
      while (current && depth < 3) {
        if (current.textContent) {
          push(current.textContent);
        }
        push(current.getAttribute('data-qa'));
        push(current.getAttribute('data-testid'));
        push(current.id);
        
        current = current.parentElement;
        depth++;
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
      // 2. Exact keyword matches
      for (const kw of rules.exact) {
        const normKw = normalizeString(kw);
        if (normalizedToMatch === normKw || normalizedToMatch.split(/\s+/).includes(normKw)) {
          score += 100;
        } else if (normalizedToMatch.includes(normKw)) {
          score += 60;
        }
      }

      // 3. Partial keyword matches
      for (const kw of rules.partial) {
        const normKw = normalizeString(kw);
        if (normalizedToMatch.includes(normKw)) {
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

    return score;
  };

  const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'image', 'reset', 'checkbox', 'radio', 'file', 'password', 'range', 'color']);

  // ── Typeahead / combobox fields (e.g. Greenhouse "Location (City)" and the
  // phone "Country" selector) ─────────────────────────────────────────────────
  // These React widgets ignore a directly-set value: you must "type" into them
  // so the suggestion list opens, then click a matching option. This is a best-
  // effort handler — it types the value, waits for options, and selects the
  // option whose text best matches.
  const selectFromTypeahead = (input, value) => {
    try {
      input.focus();
      setNativeValue(input, value);
      const lastChar = value.slice(-1) || 'a';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: lastChar, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: lastChar, bubbles: true }));

      // Options render asynchronously; give the widget time to fetch/render them.
      setTimeout(() => {
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
            vegaLog(`• Typed "${trunc(value)}" into a typeahead, but no suggestions appeared — you may need to pick one manually.`);
            return;
          }
          const normVal = normalizeString(value);
          let target = options.find(o => normalizeString(o.textContent) === normVal)
            || options.find(o => normalizeString(o.textContent).includes(normVal))
            || options[0];
          if (target) {
            target.scrollIntoView({ block: 'nearest' });
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            target.click();
            filledCount++;
            highlight(input);
            vegaLog(`✓ Selected "${trunc((target.textContent || '').trim())}" from a typeahead`);
          }
        } catch (e) { /* ignore */ }
      }, 800);
    } catch (e) { /* ignore */ }
  };

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

      if (isLocation) {
        const val = candidateCity || (profile.targetLocations && profile.targetLocations[0]) || '';
        if (val) { matchedElements.add(input); selectFromTypeahead(input, val); }
      } else if (isPhoneCountry) {
        const val = candidateCountry || 'United States';
        matchedElements.add(input); selectFromTypeahead(input, val);
      }
    });
  };

  const fillTextAndFormFields = () => {
  // 1. Fill text-shaped inputs and textareas (query including Shadow DOMs)
  const candidates = queryAllIncludingShadows('input, textarea');
  candidates.forEach(input => {
    if (input.tagName === 'INPUT' && SKIP_TYPES.has((input.type || '').toLowerCase())) return;
    if (input.disabled || input.readOnly) return;

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
      if (valToSet && (!input.value || input.value.trim() === '')) {
        setNativeValue(input, valToSet);
        filledCount++;
        highlight(input);
        vegaLog(`✓ Filled field "${bestKey}" → "${trunc(valToSet)}"`);
      } else {
        console.log(`Vega: Skipped filling "${bestKey}" (empty value or already filled: "${input.value}")`);
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

      if (selectedRadio && !selectedRadio.checked) {
        selectedRadio.checked = true;
        selectedRadio.dispatchEvent(new Event('change', { bubbles: true }));
        selectedRadio.dispatchEvent(new Event('click', { bubbles: true }));
        filledCount++;
        highlight(selectedRadio.closest('label') || selectedRadio);
        vegaLog(`✓ Selected option "${trunc(selectedRadio.value || targetSelection)}" for a multiple-choice question`);
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
      const targetState = requiresSponsorship;
      if (checkbox.checked !== targetState) {
        checkbox.checked = targetState;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
        highlight(checkbox.closest('label') || checkbox);
        vegaLog(`✓ ${targetState ? 'Checked' : 'Unchecked'} sponsorship checkbox`);
      }
    }
  });

  // 4. Native <select> dropdowns (Query including Shadow DOMs)
  const selects = queryAllIncludingShadows('select');
  selects.forEach(select => {
    if (select.disabled) return;
    const labelText = getFieldText(select);
    const normLabel = normalizeString(labelText);

    if (normLabel.includes('country') || normLabel.includes('nationality') || normLabel.includes('pais') || normLabel.includes('nacionalidad')) {
      matchedElements.add(select);
      const targetCountry = candidateCountry || 'united states';
      const normTarget = normalizeString(targetCountry);
      
      for (const option of select.options) {
        const normOpt = normalizeString(option.text || option.value);
        if (normOpt === normTarget || normOpt.includes(normTarget) || normTarget.includes(normOpt) ||
            (normTarget === 'united states' && ['us', 'usa', 'united states of america'].includes(normOpt))) {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            highlight(select);
            vegaLog(`✓ Selected country "${trunc(option.text || option.value)}"`);
          }
          return;
        }
      }
    }

    const matchAndSetOption = (targetValue) => {
      if (!targetValue) return;
      const normTarget = normalizeString(targetValue);
      for (const option of select.options) {
        const normOpt = normalizeString(option.text || option.value);
        let isMatch = normOpt.includes(normTarget) || normTarget.includes(normOpt);
        
        if (!isMatch) {
          if (normTarget === 'male' && ['male', 'man', 'm', 'masculino', 'hombre'].includes(normOpt)) {
            isMatch = true;
          } else if (normTarget === 'female' && ['female', 'woman', 'f', 'femenino', 'mujer'].includes(normOpt)) {
            isMatch = true;
          } else if (normTarget === 'non binary' && ['non-binary', 'nonbinary', 'genderqueer', 'no binario'].includes(normOpt)) {
            isMatch = true;
          } else if (normTarget.includes('decline') && (normOpt.includes('decline') || normOpt.includes('prefer not') || normOpt.includes('no decir') || normOpt.includes('no declarar'))) {
            isMatch = true;
          }
        }

        if (isMatch) {
          if (select.value !== option.value) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            filledCount++;
            highlight(select);
            vegaLog(`✓ Selected "${trunc(option.text || option.value)}" from a dropdown`);
          }
          return;
        }
      }
    };

    if (normLabel.includes('gender') || normLabel.includes('sex ') || normLabel.endsWith(' sex') || normLabel.includes('genero')) {
      matchedElements.add(select);
      matchAndSetOption(profile.gender);
    } else if (normLabel.includes('race') || normLabel.includes('ethnic') || normLabel.includes('raza') || normLabel.includes('etnia')) {
      matchedElements.add(select);
      matchAndSetOption(profile.race);
    } else if (normLabel.includes('veteran') || normLabel.includes('veterano')) {
      matchedElements.add(select);
      matchAndSetOption(profile.veteranStatus);
    } else if (normLabel.includes('disability') || normLabel.includes('handicap') || normLabel.includes('discapacidad')) {
      matchedElements.add(select);
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
    if (el.tagName === 'SELECT') {
      const normTarget = normalizeString(value);
      for (const option of el.options) {
        const normOpt = normalizeString(option.text || option.value);
        if (normOpt === normTarget || normOpt.includes(normTarget) || normTarget.includes(normOpt)) {
          if (el.value !== option.value) {
            el.value = option.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          return false;
        }
      }
      return false;
    }
    if (!el.value || el.value.trim() === '') {
      setNativeValue(el, value);
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
  // the chosen label is rendered in a sibling element — read it from there.
  const readComboboxSelection = (el) => {
    try {
      const container = el.closest('[class*="select" i], [class*="Select"], [role="combobox"]') || el.parentElement;
      if (container) {
        const sv = container.querySelector('[class*="singleValue" i], [class*="single-value" i], [class*="multiValue" i]');
        if (sv && sv.textContent && sv.textContent.trim()) return sv.textContent.trim();
      }
      const act = el.getAttribute && el.getAttribute('aria-activedescendant');
      if (act) { const o = document.getElementById(act); if (o && o.textContent && o.textContent.trim()) return o.textContent.trim(); }
    } catch (e) {}
    return '';
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
    const attachListener = (el, sig) => {
      if (el.__vegaListenerAttached) return;
      el.__vegaListenerAttached = true;

      const sendSaveValue = (value) => {
        if (value == null || value === '') return;
        if (el.__vegaLastSaved === value) return; // avoid duplicate logs/saves
        el.__vegaLastSaved = value;
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
      }
    };
    sigByElement.forEach((sig, el) => attachListener(el, sig));

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
              selectFromTypeahead(el, saved.value); // logs its own success/failure
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
      grp.boxes.forEach(({ el }) => {
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
    } catch (e) {
      console.warn('Vega: could not send discovered checkboxes:', e);
    }
  };

  // 5. Resume upload — runs first; text fields are filled after Angular settles
  if (chrome && chrome.storage && chrome.storage.local) {
    console.log("Vega: Retrieving resume from local storage...");
    chrome.storage.local.get(['resumeData', 'resumeFileName', 'resumeMime'], (result) => {
      if (!result.resumeData || !result.resumeFileName) {
        console.log("Vega: No resume found in storage. Filling text fields only.");
        fillTextAndFormFields();
        discoverAndLearnCustomFields();
        discoverAndLearnCheckboxes();
        showToast();
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

      // Fill text fields after Angular finishes re-rendering from the file upload.
      // 1000ms covers even slow Angular change detection cycles.
      setTimeout(() => {
        fillTextAndFormFields();
        discoverAndLearnCustomFields();
        discoverAndLearnCheckboxes();
        showToast();
      }, 1000);
    });
  } else {
    // No resume storage — fill text fields immediately
    fillTextAndFormFields();
    discoverAndLearnCustomFields();
    discoverAndLearnCheckboxes();
    showToast();
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
