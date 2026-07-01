// Skill / keyword extraction for resumes.
//
// Replaces the previous naive "every unique word becomes a keyword" approach.
// We match the resume text against a curated dictionary of canonical skills
// (each with a set of aliases) so that `resumeKeywords` ends up being an
// actual list of skills — clean enough to be a single source of truth shared
// by both the Chrome extension Match Score and the web "Match Mode".

// ── Normalization ────────────────────────────────────────────────────────────
// Lowercase, keep alphanumerics plus `+` and `#` (for c++ / c#), turn every
// other character into a space, and collapse runs of whitespace. Multi-word
// terms therefore become single-spaced token sequences, e.g. "Node.js" -> "node js".
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Dictionary ───────────────────────────────────────────────────────────────
// Map of canonical display name -> list of natural-language aliases. The
// canonical name is always treated as an alias of itself. Aliases are matched
// after normalization, so you can write them naturally ("Node.js", "CI/CD").
const SKILL_DICTIONARY: Record<string, string[]> = {
  // Languages
  JavaScript: ['js', 'ecmascript'],
  TypeScript: ['ts'],
  Python: [],
  Java: [],
  'C++': ['cpp'],
  'C#': ['c sharp', 'csharp'],
  C: [],
  Go: ['golang'],
  Rust: [],
  Ruby: [],
  PHP: [],
  Swift: [],
  Kotlin: [],
  'Objective-C': ['objective c'],
  Scala: [],
  R: [],
  MATLAB: [],
  Perl: [],
  Bash: ['shell scripting', 'shell'],
  SQL: [],
  HTML: ['html5'],
  CSS: ['css3'],
  Solidity: [],

  // Frontend
  React: ['react.js', 'reactjs'],
  'React Native': [],
  'Vue.js': ['vue', 'vuejs'],
  Angular: ['angularjs'],
  'Next.js': ['nextjs'],
  Svelte: ['sveltekit'],
  Redux: [],
  jQuery: [],
  Tailwind: ['tailwind css', 'tailwindcss'],
  Sass: ['scss'],
  Webpack: [],
  Vite: [],

  // Backend / frameworks
  'Node.js': ['node', 'nodejs'],
  Express: ['express.js', 'expressjs'],
  Django: [],
  Flask: [],
  FastAPI: [],
  Spring: ['spring boot'],
  '.NET': ['dotnet', 'asp.net', 'asp net'],
  Rails: ['ruby on rails'],
  Laravel: [],
  GraphQL: [],
  'REST API': ['rest', 'restful', 'rest apis'],
  gRPC: [],

  // Databases
  PostgreSQL: ['postgres', 'psql'],
  MySQL: [],
  MongoDB: ['mongo'],
  Redis: [],
  SQLite: [],
  Oracle: [],
  'SQL Server': ['mssql'],
  Elasticsearch: ['elastic search'],
  DynamoDB: [],
  Cassandra: [],
  Snowflake: [],
  BigQuery: [],

  // Cloud / DevOps
  AWS: ['amazon web services'],
  Azure: ['microsoft azure'],
  GCP: ['google cloud', 'google cloud platform'],
  Docker: [],
  Kubernetes: ['k8s'],
  Terraform: [],
  Ansible: [],
  Jenkins: [],
  'CI/CD': ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment'],
  'GitHub Actions': [],
  Git: [],
  Linux: ['unix'],
  Nginx: [],
  Kafka: ['apache kafka'],
  RabbitMQ: [],
  Serverless: ['lambda', 'aws lambda'],

  // Data / ML / AI
  'Machine Learning': ['ml'],
  'Deep Learning': [],
  'Data Science': [],
  'Data Engineering': [],
  'Data Analysis': ['data analytics'],
  TensorFlow: [],
  PyTorch: [],
  'scikit-learn': ['scikit learn', 'sklearn'],
  Pandas: [],
  NumPy: [],
  Spark: ['apache spark', 'pyspark'],
  Airflow: ['apache airflow'],
  Tableau: [],
  'Power BI': ['powerbi'],
  'Computer Vision': [],
  NLP: ['natural language processing'],
  'LLM': ['llms', 'large language models', 'generative ai', 'genai'],
  ETL: [],

  // Mobile
  iOS: [],
  Android: [],
  Flutter: [],

  // Methodologies / PM
  Agile: [],
  Scrum: [],
  Kanban: [],
  Jira: [],
  Confluence: [],
  'Product Management': [],
  'Project Management': [],
  'Program Management': [],
  Roadmapping: ['roadmap', 'product roadmap', 'program roadmaps'],
  'Stakeholder Management': [],
  'Cross-functional Leadership': ['cross functional', 'cross functional leadership'],

  // Design
  Figma: [],
  Sketch: [],
  'Adobe XD': [],
  Photoshop: [],
  Illustrator: [],
  'UI/UX': ['ui ux', 'ux design', 'ui design', 'user experience'],

  // Hardware / robotics (kept from the existing keyword dictionary)
  Robotics: [],
  ROS: ['ros2'],
  'Embedded Systems': ['embedded'],
  Firmware: [],
  'PCB Design': ['pcb'],
  CAD: [],
  'Mechanical Engineering': [],
  'Electrical Engineering': [],
  'Supply Chain': [],
  Manufacturing: [],
  NPI: ['new product introduction'],
  'System Design': ['systems design'],

  // General engineering / soft skills that are commonly screened for
  Microservices: ['micro services'],
  'Test-Driven Development': ['tdd', 'test driven development'],
  'Unit Testing': [],
  'System Architecture': [],
  Cybersecurity: ['information security', 'infosec'],
  Networking: [],
  'A/B Testing': ['a b testing', 'ab testing'],
  SEO: [],
  Excel: [],
  Salesforce: [],
  SAP: [],
};

// Precompute a list of { display, patterns } where patterns are normalized
// alias strings, longest first so multi-word skills win over their substrings.
interface CompiledSkill {
  display: string;
  patterns: string[];
}

const COMPILED: CompiledSkill[] = Object.entries(SKILL_DICTIONARY).map(([display, aliases]) => {
  const patterns = Array.from(new Set([display, ...aliases].map(normalize))).filter(Boolean);
  return { display, patterns };
});

// Flat lookup of normalized alias -> canonical display, used for manual entry.
const ALIAS_TO_DISPLAY = new Map<string, string>();
for (const { display, patterns } of COMPILED) {
  for (const p of patterns) {
    if (!ALIAS_TO_DISPLAY.has(p)) ALIAS_TO_DISPLAY.set(p, display);
  }
}

export const skillExtractionService = {
  // Extract the set of canonical skills mentioned in a block of text.
  extractSkills(text: string): string[] {
    if (!text) return [];
    const haystack = ` ${normalize(text)} `;
    const found: string[] = [];
    for (const { display, patterns } of COMPILED) {
      if (patterns.some(p => haystack.includes(` ${p} `))) {
        found.push(display);
      }
    }
    return found;
  },

  // Canonicalize a single user-entered keyword. If it matches a known alias we
  // return the canonical display name; otherwise we return a cleaned version so
  // custom keywords still work.
  canonicalize(input: string): string | null {
    const norm = normalize(input);
    if (!norm) return null;
    return ALIAS_TO_DISPLAY.get(norm) ?? norm;
  },
};
