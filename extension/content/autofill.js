// Injected into the page
window.runVegaAutofill = function(profile) {
  console.log("Vega Autofill started with profile:", profile);

  // We map standardized profile keys to common input field names/IDs/labels found on job boards
  // Greenhouse, Lever, Workday, etc.
  const nameParts = (profile.user?.name || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const fieldMapping = {
    first_name: [firstName],
    last_name: [lastName],
    name: [profile.user?.name],
    email: [profile.user?.email],
    phone: [profile.phone],
    linkedin: [profile.linkedInUrl],
    github: [profile.githubUrl],
    portfolio: [profile.portfolioUrl],
    website: [profile.portfolioUrl]
  };

  // Selectors to look for based on common name or id attributes
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

  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"]');
  let filledCount = 0;

  inputs.forEach(input => {
    const nameAtt = (input.getAttribute('name') || '').toLowerCase();
    const idAtt = (input.getAttribute('id') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();

    const textToMatch = `${nameAtt} ${idAtt} ${placeholder}`;

    // Determine what kind of field this is
    for (const [fieldKey, fieldKeywords] of Object.entries(keywords)) {
      if (fieldKeywords.some(kw => textToMatch.includes(kw))) {
        // We found a match, check if we have data for it
        const values = fieldMapping[fieldKey];
        const valToSet = values && values[0];
        if (valToSet && !input.value) { // Don't overwrite if user already typed something
          input.value = valToSet;
          // Dispatch events so React/Vue/Angular on the page registers the change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          filledCount++;
          input.style.backgroundColor = '#e0e7ff'; // Highlight slightly to show it was autofilled
          break; // Stop checking other keywords for this input
        }
      }
    }
  });

  console.log(`Vega Autofill complete. Filled ${filledCount} fields.`);
};
