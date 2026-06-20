import { useEffect, useState } from 'react';
import {
  fetchProfile, updateProfile, uploadResumePdf, updateProfileKeywords,
  fetchCustomFields, updateCustomFieldValue, deleteCustomField,
} from '../api/client';

interface CustomField {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  value: string | null;
  options: string[];
  lastSeenUrl?: string | null;
  updatedAt: string;
}

export default function CandidateProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
  const [savingFieldId, setSavingFieldId] = useState<string | null>(null);
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);

  useEffect(() => {
    fetchProfile().then(setProfile).catch(console.error);
    fetchCustomFields().then((fields: CustomField[]) => {
      setCustomFields(fields);
      setFieldDrafts(Object.fromEntries(fields.map(f => [f.id, f.value ?? ''])));
    }).catch(console.error);
  }, []);

  const handleSaveCustomField = async (id: string) => {
    setSavingFieldId(id);
    try {
      const updated = await updateCustomFieldValue(id, fieldDrafts[id] ?? '');
      setCustomFields(prev => prev.map(f => (f.id === id ? updated : f)));
    } catch (err) {
      console.error(err);
      alert('Failed to save field.');
    }
    setSavingFieldId(null);
  };

  const handleDeleteCustomField = async (id: string) => {
    if (!confirm('Delete this saved field? The extension will treat it as new next time.')) return;
    try {
      await deleteCustomField(id);
      setCustomFields(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete field.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile(profile);
      alert('Profile saved!');
    } catch(err) {
      console.error(err);
      alert('Failed to save.');
    }
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
      return alert('Please upload a valid PDF file.');
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const updatedProfile = await uploadResumePdf(formData);
      setProfile(updatedProfile);
      alert('Resume parsed and keywords extracted successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to upload and parse resume.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    const keyword = newKeyword.trim().toLowerCase();
    if (profile.resumeKeywords?.includes(keyword)) {
      setNewKeyword('');
      return;
    }
    
    const newKeywords = [...(profile.resumeKeywords || []), keyword];
    try {
      const updated = await updateProfileKeywords(newKeywords);
      setProfile(updated);
      setNewKeyword('');
    } catch (err) {
      console.error(err);
      alert('Failed to add keyword.');
    }
  };

  const handleDeleteKeyword = async (keywordToRemove: string) => {
    const newKeywords = profile.resumeKeywords.filter((k: string) => k !== keywordToRemove);
    try {
      const updated = await updateProfileKeywords(newKeywords);
      setProfile(updated);
    } catch (err) {
      console.error(err);
      alert('Failed to delete keyword.');
    }
  };

  const handleClearAllKeywords = async () => {
    if (!confirm('Are you sure you want to delete all keywords?')) return;
    try {
      const updated = await updateProfileKeywords([]);
      setProfile(updated);
    } catch (err) {
      console.error(err);
      alert('Failed to clear keywords.');
    }
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-zinc-100 sm:truncate sm:text-3xl sm:tracking-tight">
        Candidate Profile
      </h2>
      <p className="mt-2 text-sm text-gray-700 dark:text-zinc-300">Configure your skills and preferences to improve JD match scoring.</p>

      <div className="bg-white dark:bg-[#16161a] shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-6 gap-6">
          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Full Name</label>
            <input
              type="text"
              value={profile.user?.name || ''}
              onChange={e => setProfile({...profile, user: {...profile.user, name: e.target.value}})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Email</label>
            <input
              type="email"
              value={profile.user?.email || ''}
              onChange={e => setProfile({...profile, user: {...profile.user, email: e.target.value}})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Phone Number (include country code)</label>
            <input
              type="tel"
              value={profile.phone || ''}
              onChange={e => setProfile({...profile, phone: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">LinkedIn URL</label>
            <input
              type="url"
              value={profile.linkedInUrl || ''}
              onChange={e => setProfile({...profile, linkedInUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">GitHub URL</label>
            <input
              type="url"
              value={profile.githubUrl || ''}
              onChange={e => setProfile({...profile, githubUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Portfolio / Website URL</label>
            <input
              type="url"
              value={profile.portfolioUrl || ''}
              onChange={e => setProfile({...profile, portfolioUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Years of Experience</label>
            <input
              type="number"
              value={profile.yearsOfExperience || 0}
              onChange={e => setProfile({...profile, yearsOfExperience: parseInt(e.target.value)})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Work Authorization</label>
            <select
              value={profile.workAuthorization || ''}
              onChange={e => setProfile({...profile, workAuthorization: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="US Citizen">US Citizen</option>
              <option value="Permanent Resident (Green Card)">Permanent Resident (Green Card)</option>
              <option value="Need Sponsorship (H1B)">Need Sponsorship (H1B)</option>
              <option value="OPT/CPT">OPT/CPT</option>
              <option value="TN Visa">TN Visa</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Seniority Level</label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Used to match against job titles (e.g. Senior, Director)</p>
            <select
              value={profile.seniorityLevel || ''}
              onChange={e => setProfile({...profile, seniorityLevel: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Junior">Junior / Entry Level</option>
              <option value="Mid">Mid Level</option>
              <option value="Senior">Senior</option>
              <option value="Staff">Staff</option>
              <option value="Principal">Principal</option>
              <option value="Director">Director / Head of</option>
              <option value="Executive">Executive (VP, C-Level)</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Education Level</label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Highest degree completed or in progress</p>
            <select
              value={profile.educationLevel || ''}
              onChange={e => setProfile({...profile, educationLevel: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="High School">High School / GED</option>
              <option value="Associate">Associate's Degree</option>
              <option value="Bachelor's">Bachelor's Degree</option>
              <option value="Master's">Master's Degree</option>
              <option value="PhD">PhD / Doctorate</option>
            </select>
          </div>

          <div className="col-span-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Core Skills</label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Competencies and soft skills — e.g. Cross-functional Leadership, Program Management, Agile</p>
            <input
              type="text"
              value={profile.coreSkills?.join(', ')}
              onChange={e => setProfile({...profile, coreSkills: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
              placeholder="Cross-functional Leadership, Program Management, Agile, Scrum..."
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Tools & Technologies</label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Specific tools, languages, and platforms — e.g. Python, AWS, Jira, Kubernetes, React</p>
            <input
              type="text"
              value={profile.tools?.join(', ') || ''}
              onChange={e => setProfile({...profile, tools: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
              placeholder="Python, AWS, Jira, Docker, Kubernetes, React..."
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Domain Experience</label>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-1">Industries or technical domains — e.g. Robotics, AI/ML, Supply Chain, Healthcare</p>
            <input
              type="text"
              value={profile.domainExperience?.join(', ')}
              onChange={e => setProfile({...profile, domainExperience: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean)})}
              placeholder="Robotics, AI/ML, Supply Chain, Consumer Hardware..."
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <button
              type="button"
              onClick={() => setSkillsOpen(o => !o)}
              className="w-full flex items-center justify-between text-left mt-6 mb-2 border-b pb-2"
            >
              <span className="text-lg font-medium leading-6 text-gray-900 dark:text-zinc-100">Resume Parsing &amp; Keywords{profile.resumeKeywords?.length ? ` (${profile.resumeKeywords.length})` : ''}</span>
              <svg className={`h-5 w-5 text-gray-400 transition-transform ${skillsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {skillsOpen && (<>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">Upload your PDF resume to automatically extract keywords, or manage them manually. These keywords are used by the Chrome Extension to calculate a Match Score for new jobs.</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Upload Resume (PDF)</label>
              <input 
                type="file" 
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-500/15 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 disabled:opacity-50"
              />
              {isUploading && <span className="text-sm text-indigo-600 dark:text-indigo-400 mt-1 inline-block">Uploading and parsing...</span>}
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Extracted Keywords</label>
                {profile.resumeKeywords && profile.resumeKeywords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllKeywords}
                    className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.resumeKeywords && profile.resumeKeywords.length > 0 ? (
                  profile.resumeKeywords.map((kw: string) => (
                    <span key={kw} className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-500/20 px-2.5 py-0.5 text-sm font-medium text-indigo-800 dark:text-indigo-300">
                      {kw}
                      <button 
                        type="button" 
                        onClick={() => handleDeleteKeyword(kw)}
                        className="ml-1.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/25 hover:text-indigo-500 dark:hover:text-indigo-400 focus:bg-indigo-500 focus:text-white focus:outline-none"
                      >
                        <span className="sr-only">Remove {kw}</span>
                        <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                          <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                        </svg>
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400 dark:text-zinc-500">No keywords extracted yet.</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3">
              <input 
                type="text" 
                placeholder="Add a keyword manually..." 
                value={newKeyword}
                onChange={e => setNewKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' ? (e.preventDefault(), handleAddKeyword()) : null}
                className="block w-full max-w-xs shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
              />
              <button 
                type="button" 
                onClick={handleAddKeyword}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
              >
                Add
              </button>
            </div>
            </>)}
          </div>

          <div className="col-span-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-zinc-100 mt-6 mb-2 border-b pb-2">Equal Employment Opportunity (EEO)</h3>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">This data will be used by the extension to autofill demographic forms.</p>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Gender</label>
            <select
              value={profile.gender || ''}
              onChange={e => setProfile({...profile, gender: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Decline to self-identify">Decline to self-identify</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Race / Ethnicity</label>
            <select
              value={profile.race || ''}
              onChange={e => setProfile({...profile, race: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Hispanic or Latino">Hispanic or Latino</option>
              <option value="White (Not Hispanic or Latino)">White (Not Hispanic or Latino)</option>
              <option value="Black or African American">Black or African American</option>
              <option value="Asian">Asian</option>
              <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
              <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
              <option value="Two or More Races">Two or More Races</option>
              <option value="Decline to self-identify">Decline to self-identify</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Veteran Status</label>
            <select
              value={profile.veteranStatus || ''}
              onChange={e => setProfile({...profile, veteranStatus: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="I am not a protected veteran">I am not a protected veteran</option>
              <option value="I identify as one or more of the classifications of a protected veteran">I identify as one or more of the classifications of a protected veteran</option>
              <option value="I don't wish to answer">I don't wish to answer</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">Disability Status</label>
            <select
              value={profile.disabilityStatus || ''}
              onChange={e => setProfile({...profile, disabilityStatus: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Yes, I have a disability (or previously had a disability)">Yes, I have a disability</option>
              <option value="No, I don't have a disability">No, I don't have a disability</option>
              <option value="I don't wish to answer">I don't wish to answer</option>
            </select>
          </div>

          <div className="col-span-6">
            <button
              type="button"
              onClick={() => setFieldsOpen(o => !o)}
              className="w-full flex items-center justify-between text-left mt-6 mb-2 border-b pb-2"
            >
              <span className="text-lg font-medium leading-6 text-gray-900 dark:text-zinc-100">Learned Application Fields{customFields.length ? ` (${customFields.length})` : ''}</span>
              <svg className={`h-5 w-5 text-gray-400 transition-transform ${fieldsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {fieldsOpen && (<>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">
              Custom questions the Chrome extension discovered on application forms. New questions appear here automatically when you autofill a form; whatever you type into them gets remembered and reused on similar forms next time. These are unique to your account.
            </p>

            {customFields.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-zinc-500">No custom fields learned yet. Press “Autofill Form” on a job application and any unrecognized questions will show up here.</p>
            ) : (
              <div className="space-y-3">
                {customFields.map(field => (
                  <div key={field.id} className="rounded-md border border-gray-200 dark:border-white/10 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">{field.label}</label>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomField(field.id)}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium flex-shrink-0"
                      >
                        Delete
                      </button>
                    </div>
                    {field.options && field.options.length > 0 ? (
                      <>
                        <select
                          value={fieldDrafts[field.id] ?? ''}
                          onChange={e => setFieldDrafts({ ...fieldDrafts, [field.id]: e.target.value })}
                          className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
                        >
                          <option value="">Select...</option>
                          {/* keep a previously-saved answer selectable even if it isn't in the captured option list */}
                          {fieldDrafts[field.id] && !field.options.includes(fieldDrafts[field.id]) && (
                            <option value={fieldDrafts[field.id]}>{fieldDrafts[field.id]}</option>
                          )}
                          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Dropdown field · {field.options.length} option{field.options.length === 1 ? '' : 's'} captured from the form</p>
                      </>
                    ) : field.fieldType === 'textarea' ? (
                      <textarea
                        value={fieldDrafts[field.id] ?? ''}
                        onChange={e => setFieldDrafts({ ...fieldDrafts, [field.id]: e.target.value })}
                        rows={3}
                        className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
                      />
                    ) : (
                      <input
                        type="text"
                        value={fieldDrafts[field.id] ?? ''}
                        onChange={e => setFieldDrafts({ ...fieldDrafts, [field.id]: e.target.value })}
                        className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 dark:border-white/15 rounded-md p-2 border"
                      />
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleSaveCustomField(field.id)}
                        disabled={savingFieldId === field.id || (fieldDrafts[field.id] ?? '') === (field.value ?? '')}
                        className="inline-flex justify-center py-1.5 px-3 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40"
                      >
                        {savingFieldId === field.id ? 'Saving...' : 'Save answer'}
                      </button>
                      {!field.value && <span className="text-xs text-amber-600 dark:text-amber-400">Needs an answer</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>)}
          </div>

        </div>
        <div className="mt-6">
          <button onClick={handleSave} disabled={saving} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
