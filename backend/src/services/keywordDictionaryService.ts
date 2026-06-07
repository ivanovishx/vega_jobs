// A simple rules-based dictionary for job description parsing

export const domains = [
  "robotics", "consumer hardware", "npi", "manufacturing",
  "software/hardware integration", "ai/ml", "automation",
  "evt", "dvt", "pvt", "supply chain", "logistics", "aerospace", "automotive"
];

export const tools = [
  "jira", "confluence", "asana", "kubernetes", "docker", "aws", "gcp", "azure",
  "git", "python", "c++", "rust", "typescript", "react", "node.js", "ros", "ros2"
];

export const skills = [
  "cross-functional leadership", "program roadmaps", "supplier management",
  "factory readiness", "product launches", "agile", "scrum", "system design",
  "embedded systems", "firmware", "machine learning", "computer vision",
  "pcb design", "cad", "mechanical engineering"
];

export const roles = [
  "software engineer", "hardware engineer", "technical program manager", "tpm",
  "product manager", "engineering manager", "data scientist", "mechanical engineer",
  "electrical engineer"
];

export const riskFlags = [
  "fast-paced environment", "work hard play hard", "ninja", "rockstar",
  "wear many hats", "equity only", "unpaid", "urgent hire"
];

export const visaKeywords = [
  "h1b", "visa sponsorship", "sponsor", "opt", "cpt", "us citizen", "green card",
  "authorized to work"
];

export const keywordDictionaryService = {
  getDomains: () => domains,
  getTools: () => tools,
  getSkills: () => skills,
  getRoles: () => roles,
  getRiskFlags: () => riskFlags,
  getVisaKeywords: () => visaKeywords,
};
