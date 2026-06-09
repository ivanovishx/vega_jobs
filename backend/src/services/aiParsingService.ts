import * as cheerio from 'cheerio';
import axios from 'axios';
import Tesseract from 'tesseract.js';

export const aiParsingService = {
  async parseFromUrl(url: string) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const html = response.data;
      const $ = cheerio.load(html);
      
      let companyName = '';
      let jobTitle = '';
      let location = '';
      let salaryRange = '';
      let notes = 'Parsed from URL.';

      // Extract basic text from body for regex
      const bodyText = $('body').text().replace(/\s+/g, ' ');

      // Basic regex for salary (e.g. $100,000 - $150,000, $120k)
      const salaryMatch = bodyText.match(/\$[0-9]{2,3}(?:,[0-9]{3}|k)(?:\s*(?:-|to)\s*\$[0-9]{2,3}(?:,[0-9]{3}|k))?/i);
      if (salaryMatch) {
        salaryRange = salaryMatch[0];
      }

      // Basic heuristic for location from meta tags
      const metaLoc = $('meta[name="twitter:data2"]').attr('content') || 
                      $('meta[property="og:locality"]').attr('content') ||
                      $('span[class*="location"], div[class*="location"]').first().text().trim();
      if (metaLoc && metaLoc.length < 50) {
        location = metaLoc;
      }

      // Try <title> first because it often contains the company name
      let pageTitle = $('title').text().trim();
      const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
      
      // Clean up common Greenhouse/Lever prefixes
      if (pageTitle.startsWith('Job Application for ')) {
        pageTitle = pageTitle.replace('Job Application for ', '');
      }

      const textToParse = pageTitle || ogTitle || '';
      
      // Simple heuristic for "Job Title at Company" or "Job Title - Company"
      if (textToParse) {
        if (textToParse.includes(' at ')) {
          // e.g. "Fleet Manager Product Manager at Airspace"
          const parts = textToParse.split(' at ');
          jobTitle = parts[0].trim();
          companyName = parts[1].split(/[|-]/)[0].trim(); // Remove trailing extra text
        } else if (textToParse.includes('-')) {
          const parts = textToParse.split('-');
          jobTitle = parts[0].trim();
          companyName = parts.length > 1 ? parts[1].trim() : '';
        } else if (textToParse.includes('|')) {
          const parts = textToParse.split('|');
          jobTitle = parts[0].trim();
          companyName = parts.length > 1 ? parts[1].trim() : '';
        } else {
          jobTitle = textToParse;
          // If we couldn't find the company in the title, but og:title exists, maybe og:site_name has it
          companyName = $('meta[property="og:site_name"]').attr('content')?.trim() || '';
        }
      }

      // Cleanup
      if (!companyName) companyName = 'Unknown Company';
      if (!jobTitle) jobTitle = 'Unknown Title';

      return { companyName, jobTitle, location, salaryRange, notes };

    } catch (err: any) {
      console.error("Error parsing URL via Cheerio:", err);
      throw new Error(`Failed to extract job info from URL: ${err.message}`);
    }
  },

  async parseFromImage(mimeType: string, base64Data: string) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const result = await Tesseract.recognize(buffer, 'eng');
      const text = result.data.text;

      // First check if the OCR grabbed a URL from the browser address bar!
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        try {
          // Auto-correct common OCR mistakes for URLs
          let urlStr = urlMatch[0];
          urlStr = urlStr.replace(/\.o\//g, '.io/').replace(/\.con\//g, '.com/');
          
          const urlResult = await aiParsingService.parseFromUrl(urlStr);
          return { ...urlResult, jobUrl: urlStr, notes: 'Parsed from URL found in image.' };
        } catch (e) {
          console.warn("Found URL in image but failed to parse it, falling back to pure OCR:", e);
        }
      }

      let companyName = 'Unknown Company';
      let jobTitle = 'Unknown Title';
      let notes = 'Parsed from image OCR.';

      // Filter out common noise/navigation words
      const noiseWords = ['back to jobs', 'apply', 'share', 'careers', 'home', 'search', 'sign in', 'login', 'menu', 'about us'];
      const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 3)
        .filter(l => {
          const lower = l.toLowerCase();
          return !noiseWords.some(w => lower.includes(w)) && !lower.includes('http'); // Filter out any lines with URLs
        });

      if (lines.length > 0) {
        jobTitle = lines[0].replace(/[^a-zA-Z0-9\s\-_]/g, '').trim(); // Basic cleanup
      }
      if (lines.length > 1) {
        companyName = lines[1].replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
      }

      return { companyName, jobTitle, notes };
    } catch (err: any) {
      console.error("Error parsing image via OCR:", err);
      throw new Error(`Failed to extract job info from image: ${err.message}`);
    }
  }
};
