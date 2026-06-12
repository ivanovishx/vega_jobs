window.runVegaAutofill = function(profile) {
  console.log("Vega Autofill started with profile:", profile);

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
      exact: ['location', 'address', 'direccion', 'dirección', 'ubicacion', 'ubicación', 'current location', 'where are you located', 'home address', 'current city', 'ciudad actual'],
      partial: ['location', 'address', 'ubicacion', 'direccion']
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
      const valToSet = fieldMapping[bestKey];
      console.log(`Vega: Matched field "${bestKey}" with score ${bestScore} for input:`, input);
      if (valToSet && (!input.value || input.value.trim() === '')) {
        setNativeValue(input, valToSet);
        filledCount++;
        highlight(input);
        console.log(`Vega: Filled "${bestKey}" with "${valToSet}"`);
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
      const targetState = requiresSponsorship;
      if (checkbox.checked !== targetState) {
        checkbox.checked = targetState;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        filledCount++;
        highlight(checkbox.closest('label') || checkbox);
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
          }
          return;
        }
      }
    };

    if (normLabel.includes('gender') || normLabel.includes('sex ') || normLabel.endsWith(' sex') || normLabel.includes('genero')) {
      matchAndSetOption(profile.gender);
    } else if (normLabel.includes('race') || normLabel.includes('ethnic') || normLabel.includes('raza') || normLabel.includes('etnia')) {
      matchAndSetOption(profile.race);
    } else if (normLabel.includes('veteran') || normLabel.includes('veterano')) {
      matchAndSetOption(profile.veteranStatus);
    } else if (normLabel.includes('disability') || normLabel.includes('handicap') || normLabel.includes('discapacidad')) {
      matchAndSetOption(profile.disabilityStatus);
    }
  });
  }; // end fillTextAndFormFields

  // 5. Resume upload — runs first; text fields are filled after Angular settles
  if (chrome && chrome.storage && chrome.storage.local) {
    console.log("Vega: Retrieving resume from local storage...");
    chrome.storage.local.get(['resumeData', 'resumeFileName', 'resumeMime'], (result) => {
      if (!result.resumeData || !result.resumeFileName) {
        console.log("Vega: No resume found in storage. Filling text fields only.");
        fillTextAndFormFields();
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
        showToast();
      }, 1000);
    });
  } else {
    // No resume storage — fill text fields immediately
    fillTextAndFormFields();
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
