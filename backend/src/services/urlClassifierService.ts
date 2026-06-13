export type UrlCategory = 'Job' | 'Careers' | 'Company';

// Hostnames that indicate a careers/ATS context.
const JOB_HOST_PATTERNS: RegExp[] = [
  /(?:^|\.)careers?\./,
  /(?:^|\.)jobs?\./,
  /myworkdayjobs\.com$/,
  /greenhouse\.io$/,
  /lever\.co$/,
  /smartrecruiters\.com$/,
  /ashbyhq\.com$/,
  /workable\.com$/,
  /bamboohr\.com$/,
  /icims\.com$/,
  /taleo\.net$/,
  /jobvite\.com$/,
  /breezy\.hr$/,
  /recruitee\.com$/,
];

// Path fragments that indicate a careers/ATS context.
const JOB_PATH_SIGNALS: string[] = [
  '/jobs/', '/job/', '/careers/', '/career/',
  '/positions/', '/position/', '/openings/', '/opening/',
  '/work-with-us/', '/join-us/', '/hiring/',
];

// LinkedIn jobs has the path signal but the host doesn't match the patterns above.
const LINKEDIN_JOB = /linkedin\.com$/i;

// Domains that are never job-related and should be ignored entirely.
const BLOCKLIST_DOMAINS: string[] = [
  // Google services
  'google.com', 'gmail.com', 'mail.google.com', 'calendar.google.com',
  'accounts.google.com', 'drive.google.com', 'docs.google.com',
  'sheets.google.com', 'slides.google.com', 'meet.google.com',
  'photos.google.com', 'maps.google.com', 'translate.google.com',
  'analytics.google.com', 'ads.google.com', 'search.google.com',
  'firebase.google.com', 'cloud.google.com', 'gemini.google.com',
  'chrome.google.com',
  // Microsoft services
  'microsoft.com', 'office.com', 'outlook.com', 'live.com', 'hotmail.com',
  'onedrive.live.com', 'teams.microsoft.com', 'bing.com', 'azure.com',
  'portal.azure.com', 'login.microsoftonline.com', 'copilot.microsoft.com',
  // Apple
  'apple.com', 'icloud.com', 'appleid.apple.com',
  // Social media
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'tiktok.com',
  'reddit.com', 'pinterest.com', 'youtube.com', 'twitch.tv', 'discord.com',
  'threads.net', 'snapchat.com', 'whatsapp.com', 'telegram.org', 'tumblr.com',
  // Dev tools / hosting / cloud
  'github.com', 'gitlab.com', 'bitbucket.org',
  'vercel.com', 'render.com', 'netlify.com', 'heroku.com',
  'supabase.com', 'planetscale.com', 'aws.amazon.com',
  'console.aws.amazon.com', 'digitalocean.com', 'railway.app',
  'fly.io', 'cloudflare.com', 'npmjs.com', 'stackoverflow.com',
  'stackexchange.com', 'dev.to',
  // AI tools
  'chatgpt.com', 'openai.com', 'claude.ai', 'anthropic.com',
  'perplexity.ai', 'midjourney.com', 'huggingface.co', 'mistral.ai',
  // Communication / productivity
  'slack.com', 'notion.so', 'airtable.com', 'trello.com',
  'asana.com', 'monday.com', 'jira.atlassian.com', 'confluence.atlassian.com',
  'atlassian.com', 'zoom.us', 'whereby.com', 'calendly.com', 'loom.com',
  'miro.com', 'figma.com', 'canva.com', 'dropbox.com',
  // Browsers / search
  'yahoo.com', 'duckduckgo.com', 'brave.com', 'mozilla.org', 'ecosia.org',
  // E-commerce
  'amazon.com', 'ebay.com', 'etsy.com', 'shopify.com',
  'mercadolibre.com', 'walmart.com', 'aliexpress.com',
  // Banking / finance
  'paypal.com', 'stripe.com', 'wise.com', 'coinbase.com',
  'chase.com', 'bankofamerica.com', 'wellsfargo.com',
  // News / media / blogging
  'medium.com', 'substack.com', 'wordpress.com', 'blogger.com',
  'nytimes.com', 'bbc.com', 'cnn.com', 'techcrunch.com',
  'wired.com', 'theverge.com', 'forbes.com',
  // Own app
  'vega-jobs.vercel.app',
];

// Text signals that confirm a page is a specific job posting.
export const JOB_TEXT_SIGNALS: string[] = [
  // English
  'responsibilities', 'qualifications', 'requirements', "what you'll do",
  "what we're looking for", 'apply now', 'apply for this job', 'submit application',
  'submit your application', 'job description', 'about the role', 'about this role',
  'minimum qualifications', 'preferred qualifications', 'you will', 'you\'ll',
  'we are looking for', 'we\'re looking for', 'this role', 'this position',
  'compensation', 'salary range', 'base salary', 'benefits include',
  // Spanish
  'responsabilidades', 'requisitos', 'calificaciones', 'solicitar ahora',
  'postular', 'descripción del puesto', 'descripción del trabajo',
  'sobre el puesto', 'sobre el rol', 'buscamos', 'estamos buscando',
  'salario', 'compensación', 'beneficios incluyen',
];

// Text signals that confirm a page is a careers listing page.
export const CAREERS_TEXT_SIGNALS: string[] = [
  // English
  'open positions', 'open roles', 'job openings', 'search jobs', 'browse jobs',
  'all jobs', 'view all jobs', 'filter by', 'job results', 'positions available',
  'explore opportunities', 'find your role', 'find a job', 'current openings',
  'available positions', 'join our team', 'work with us', 'we\'re hiring',
  'sort by', 'results found', 'jobs found', 'no jobs found',
  // Spanish
  'puestos disponibles', 'buscar empleos', 'oportunidades de empleo',
  'ver empleos', 'explorar vacantes', 'vacantes disponibles',
  'únete a nuestro equipo', 'trabaja con nosotros', 'estamos contratando',
  'filtrar por', 'resultados encontrados',
];

// Text signals that confirm a homepage is a real company (not a tool/service).
export const COMPANY_TEXT_SIGNALS: string[] = [
  // English
  'careers', 'we\'re hiring', 'join our team', 'join us', 'work with us',
  'about us', 'our mission', 'our values', 'who we are', 'our story',
  'our products', 'our services', 'contact us', 'investors', 'press',
  'get started', 'learn more',
  // Spanish
  'carreras', 'únete', 'trabaja con nosotros', 'sobre nosotros',
  'nuestra misión', 'nuestros valores', 'quiénes somos', 'nuestra historia',
  'nuestros productos', 'contáctanos', 'inversionistas',
];

export function isBlocklisted(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return BLOCKLIST_DOMAINS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}

export function scoreTextSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter(s => lower.includes(s)).length;
}

function getHomepage(parsed: URL): string {
  const host = parsed.hostname.replace(/^www\./i, '');
  return `${parsed.protocol}//${host}`;
}

function hasJobIdSegment(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  return segments.some((s) =>
    /^\d{4,}$/.test(s) ||              // 4+ digit number
    /^[A-Z]+[-_]?\d{3,}/i.test(s) ||   // JOB12345, R-2839, REQ_1234
    /^[a-f0-9]{8,}$/i.test(s) ||       // hex IDs
    /^[A-Z0-9]{6,}$/.test(s) ||        // generic upper-case IDs (ABC123XY)
    /[-_]\d{4,}$/.test(s)              // slug ending in numeric ID (service-technician-273063)
  );
}

export function classifyUrl(url: string): { category: UrlCategory; normalizedUrl: string; homepageUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { category: 'Company', normalizedUrl: url, homepageUrl: url };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const homepageUrl = getHomepage(parsed);

  const isJobHost = JOB_HOST_PATTERNS.some((p) => p.test(host)) || (LINKEDIN_JOB.test(host) && path.startsWith('/jobs'));
  const hasJobPath = JOB_PATH_SIGNALS.some((s) => path.includes(s));

  if (!isJobHost && !hasJobPath) {
    return { category: 'Company', normalizedUrl: homepageUrl, homepageUrl };
  }

  const category: UrlCategory = hasJobIdSegment(path) ? 'Job' : 'Careers';
  const normalizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}` || homepageUrl;
  return { category, normalizedUrl, homepageUrl };
}

export function inferCompanyNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.replace(/^www\./i, '');
    host = host.replace(/^(careers?|jobs?|boards|apply|hire|recruiting|talent)\./, '');
    const parts = host.split('.');
    const knownAts = /(lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/i;
    if (knownAts.test(host)) {
      const pathParts = u.pathname.split('/').filter(Boolean);
      if (pathParts[0]) return capitalize(pathParts[0]);
    }
    const root = parts.length >= 2 ? parts[parts.length - 2] : host;
    return capitalize(root);
  } catch {
    return 'Unknown Company';
  }
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
