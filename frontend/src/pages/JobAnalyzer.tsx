import { useState } from 'react';
import { analyzeJobDescription } from '../api/client';
import { AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

export default function JobAnalyzer() {
  const [rawText, setRawText] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await analyzeJobDescription({
        rawJobDescription: rawText
      });
      setAnalysis(res);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-zinc-100 sm:truncate sm:text-3xl sm:tracking-tight">
        Job Analyzer
      </h2>
      <p className="mt-2 text-sm text-gray-700 dark:text-zinc-300">Paste a job description below to get a deterministic match score against your profile.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <label htmlFor="jd" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
            Raw Job Description
          </label>
          <div className="mt-1">
            <textarea
              id="jd"
              rows={15}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 dark:border-white/15 rounded-md p-4"
              placeholder="Paste job description here..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !rawText}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze JD'}
          </button>
        </div>

        {analysis && (
          <div className="bg-white dark:bg-[#16161a] shadow sm:rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-indigo-50 dark:bg-indigo-500/15 border-b border-indigo-100 dark:border-indigo-500/30 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-indigo-900 dark:text-indigo-200">Analysis Results</h3>
                <p className="mt-1 max-w-2xl text-sm text-indigo-700 dark:text-indigo-300">Deterministic rules-based scoring</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-indigo-700 dark:text-indigo-300 block">Overall Score</span>
                <span className={clsx(
                  "text-3xl font-bold",
                  analysis.overallScore >= 80 ? "text-green-600 dark:text-green-400" : analysis.overallScore >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
                )}>
                  {analysis.overallScore}%
                </span>
              </div>
            </div>
            <div className="px-4 py-5 sm:p-6 space-y-6">
              
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-100 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1 text-green-500" /> Suggested Strategy
                </h4>
                <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400 font-semibold">{analysis.suggestedApplicationStrategy}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{analysis.explanation}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Score Breakdown</h4>
                <div className="mt-2 text-sm text-gray-600 dark:text-zinc-400 grid grid-cols-2 gap-2">
                  <div>Skills: {analysis.requiredSkillsScore}/35</div>
                  <div>Experience: {analysis.experienceScore}/25</div>
                  <div>Domain: {analysis.domainScore}/15</div>
                  <div>Visa: {analysis.visaScore}/5</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Matched Keywords</h4>
                  <ul className="mt-2 text-sm text-green-600 dark:text-green-400 list-disc pl-5">
                    {analysis.matchedKeywords.map((k: string) => <li key={k}>{k}</li>)}
                    {analysis.matchedKeywords.length === 0 && <span className="text-gray-400 dark:text-zinc-500">None</span>}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-zinc-100">Missing Keywords</h4>
                  <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc pl-5">
                    {analysis.missingKeywords.map((k: string) => <li key={k}>{k}</li>)}
                    {analysis.missingKeywords.length === 0 && <span className="text-gray-400 dark:text-zinc-500">None</span>}
                  </ul>
                </div>
              </div>

              {analysis.riskFlags.length > 0 && (
                <div className="bg-red-50 dark:bg-red-500/10 p-4 rounded-md border border-red-100 dark:border-red-500/20">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-1" /> Risk Flags Detected
                  </h4>
                  <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc pl-5">
                    {analysis.riskFlags.map((flag: string) => <li key={flag}>{flag}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
