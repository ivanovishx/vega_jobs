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

  const keywords = {
    first_name: ['first_name', 'firstname', 'first-name', 'fname'],
    last_name: ['last_name', 'lastname', 'last-name', 'lname'],
    name: ['name', 'full_name', 'fullname'],
    email: ['email'],
    phone: ['phone', 'tel', 'mobile'],
    linkedin: ['linkedin'],
    github: ['github'],
    portfolio: ['portfolio', 'website', 'url']
  };

  let filledCount = 0;

  // 1. Fill Text Inputs
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"]');
  inputs.forEach(input => {
    const nameAtt = (input.getAttribute('name') || '').toLowerCase();
    const idAtt = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const textToMatch = `${nameAtt} ${idAtt} ${placeholder}`;

    for (const [fieldKey, fieldKeywords] of Object.entries(keywords)) {
      if (fieldKeywords.some(kw => textToMatch.includes(kw))) {
        const values = fieldMapping[fieldKey];
        const valToSet = values && values[0];
        if (valToSet && !input.value) {
          input.value = valToSet;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
          input.style.backgroundColor = '#e0e7ff';
          break;
        }
      }
    }
  });

  // 2. Select Country Dropdowns (set to US)
  const selects = document.querySelectorAll('select');
  selects.forEach(select => {
    const nameAtt = (select.getAttribute('name') || '').toLowerCase();
    const idAtt = (select.getAttribute('id') || '').toLowerCase();
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
