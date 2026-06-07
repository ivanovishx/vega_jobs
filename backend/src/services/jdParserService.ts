import { keywordDictionaryService } from './keywordDictionaryService';

export interface ParsedJD {
  title?: string;
  company?: string;
  seniority?: string;
  location?: string;
  workMode?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  salaryRange?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  yearsOfExperience?: number;
  domainKeywords: string[];
  responsibilities: string[];
  tools: string[];
  visaLanguage: string[];
  riskFlags: string[];
}

export const jdParserService = {
  parse(rawText: string): ParsedJD {
    const lowerText = rawText.toLowerCase();

    // 1. Extract tools
    const tools = keywordDictionaryService.getTools().filter(tool => lowerText.includes(tool));

    // 2. Extract domains
    const domainKeywords = keywordDictionaryService.getDomains().filter(domain => lowerText.includes(domain));

    // 3. Extract skills
    const skills = keywordDictionaryService.getSkills().filter(skill => lowerText.includes(skill));

    // 4. Extract risk flags
    const riskFlags = keywordDictionaryService.getRiskFlags().filter(flag => lowerText.includes(flag));

    // 5. Extract visa language
    const visaLanguage = keywordDictionaryService.getVisaKeywords().filter(visa => lowerText.includes(visa));

    // 6. Infer work mode
    let workMode: 'remote' | 'hybrid' | 'onsite' | 'unknown' = 'unknown';
    if (lowerText.includes('remote') || lowerText.includes('work from home')) {
      workMode = 'remote';
    } else if (lowerText.includes('hybrid')) {
      workMode = 'hybrid';
    } else if (lowerText.includes('onsite') || lowerText.includes('in office')) {
      workMode = 'onsite';
    }

    // 7. Infer Years of Experience (very basic regex)
    let yearsOfExperience = undefined;
    const yoeMatch = lowerText.match(/(\d+)\+?\s*(years|yrs)\s+(of\s+)?experience/);
    if (yoeMatch && yoeMatch[1]) {
      yearsOfExperience = parseInt(yoeMatch[1], 10);
    }

    // 8. Basic Seniority
    let seniority = 'Mid';
    if (lowerText.includes('senior') || lowerText.includes('staff') || lowerText.includes('principal') || lowerText.includes('lead')) {
      seniority = 'Senior';
    } else if (lowerText.includes('junior') || lowerText.includes('entry level') || lowerText.includes('new grad')) {
      seniority = 'Junior';
    }

    // Simple split for required vs preferred (just splitting the skills array in half for MVP mock logic, or checking against "preferred" section if we had better NLP)
    // For MVP, we'll put most in required and a few in preferred randomly or based on index.
    const requiredSkills = skills.slice(0, Math.ceil(skills.length * 0.7));
    const preferredSkills = skills.slice(Math.ceil(skills.length * 0.7));

    return {
      title: 'Parsed Title (MVP)', // Hard to reliably extract without HTML structure or LLM
      company: 'Parsed Company (MVP)',
      seniority,
      workMode,
      yearsOfExperience,
      requiredSkills,
      preferredSkills,
      domainKeywords,
      tools,
      visaLanguage,
      riskFlags,
      responsibilities: ['Responsibility 1', 'Responsibility 2'] // Hard to extract reliably via basic rules
    };
  }
};
