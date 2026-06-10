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
    /^[A-Z0-9]{6,}$/.test(s)           // generic upper-case IDs (ABC123XY)
  );
}

export function classifyUrl(url: string): { category: UrlCategory; normalizedUrl: string; homepageUrl: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Unparseable — treat as Company with the raw string as a homepage placeholder.
    return { category: 'Company', normalizedUrl: url, homepageUrl: url };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const homepageUrl = getHomepage(parsed);

  const isJobHost = JOB_HOST_PATTERNS.some((p) => p.test(host)) || (LINKEDIN_JOB.test(host) && path.startsWith('/jobs'));
  const hasJobPath = JOB_PATH_SIGNALS.some((s) => path.includes(s));

  if (!isJobHost && !hasJobPath) {
    // Not job-related — Company entry, normalize to homepage.
    return { category: 'Company', normalizedUrl: homepageUrl, homepageUrl };
  }

  // Job-related. Distinguish Job vs Careers by presence of an ID-like segment.
  const category: UrlCategory = hasJobIdSegment(path) ? 'Job' : 'Careers';
  // Strip query/hash so the same job posting visited with different params dedupes.
  const normalizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}` || homepageUrl;
  return { category, normalizedUrl, homepageUrl };
}

// Best-effort company name from a URL hostname (used when we don't scrape the page).
export function inferCompanyNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    let host = u.hostname.replace(/^www\./i, '');
    // Strip well-known ATS or recruiting subdomains.
    host = host.replace(/^(careers?|jobs?|boards|apply|hire|recruiting|talent)\./, '');
    const parts = host.split('.');
    // Special case: jobs.lever.co/ACME, boards.greenhouse.io/ACME — first path segment is the company.
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
