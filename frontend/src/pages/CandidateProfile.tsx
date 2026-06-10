import { useEffect, useState } from 'react';
import { fetchProfile, updateProfile, uploadResumePdf, updateProfileKeywords } from '../api/client';

export default function CandidateProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => {
    fetchProfile().then(setProfile).catch(console.error);
  }, []);

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

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
        Candidate Profile
      </h2>
      <p className="mt-2 text-sm text-gray-700">Configure your skills and preferences to improve JD match scoring.</p>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-6 gap-6">
          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              value={profile.user?.name || ''}
              onChange={e => setProfile({...profile, user: {...profile.user, name: e.target.value}})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={profile.user?.email || ''}
              onChange={e => setProfile({...profile, user: {...profile.user, email: e.target.value}})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Phone Number (include country code)</label>
            <input
              type="tel"
              value={profile.phone || ''}
              onChange={e => setProfile({...profile, phone: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">LinkedIn URL</label>
            <input
              type="url"
              value={profile.linkedInUrl || ''}
              onChange={e => setProfile({...profile, linkedInUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">GitHub URL</label>
            <input
              type="url"
              value={profile.githubUrl || ''}
              onChange={e => setProfile({...profile, githubUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Portfolio / Website URL</label>
            <input
              type="url"
              value={profile.portfolioUrl || ''}
              onChange={e => setProfile({...profile, portfolioUrl: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
            <input
              type="number"
              value={profile.yearsOfExperience || 0}
              onChange={e => setProfile({...profile, yearsOfExperience: parseInt(e.target.value)})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>
          
          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Work Authorization</label>
            <input
              type="text"
              value={profile.workAuthorization || ''}
              onChange={e => setProfile({...profile, workAuthorization: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <label className="block text-sm font-medium text-gray-700">Core Skills (comma separated)</label>
            <input
              type="text"
              value={profile.coreSkills?.join(', ')}
              onChange={e => setProfile({...profile, coreSkills: e.target.value.split(',').map((s: string) => s.trim())})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <label className="block text-sm font-medium text-gray-700">Domain Experience (comma separated)</label>
            <input
              type="text"
              value={profile.domainExperience?.join(', ')}
              onChange={e => setProfile({...profile, domainExperience: e.target.value.split(',').map((s: string) => s.trim())})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            />
          </div>

          <div className="col-span-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mt-6 mb-2 border-b pb-2">Resume Parsing & Keywords</h3>
            <p className="text-sm text-gray-500 mb-4">Upload your PDF resume to automatically extract keywords, or manage them manually. These keywords are used by the Chrome Extension to calculate a Match Score for new jobs.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Resume (PDF)</label>
              <input 
                type="file" 
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
              />
              {isUploading && <span className="text-sm text-indigo-600 mt-1 inline-block">Uploading and parsing...</span>}
            </div>

            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">Extracted Keywords</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile.resumeKeywords && profile.resumeKeywords.length > 0 ? (
                  profile.resumeKeywords.map((kw: string) => (
                    <span key={kw} className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-800">
                      {kw}
                      <button 
                        type="button" 
                        onClick={() => handleDeleteKeyword(kw)}
                        className="ml-1.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:bg-indigo-500 focus:text-white focus:outline-none"
                      >
                        <span className="sr-only">Remove {kw}</span>
                        <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                          <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                        </svg>
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">No keywords extracted yet.</span>
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
                className="block w-full max-w-xs shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
              />
              <button 
                type="button" 
                onClick={handleAddKeyword}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
              >
                Add
              </button>
            </div>
          </div>

          <div className="col-span-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900 mt-6 mb-2 border-b pb-2">Equal Employment Opportunity (EEO)</h3>
            <p className="text-sm text-gray-500 mb-4">This data will be used by the extension to autofill demographic forms.</p>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              value={profile.gender || ''}
              onChange={e => setProfile({...profile, gender: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Decline to self-identify">Decline to self-identify</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Race / Ethnicity</label>
            <select
              value={profile.race || ''}
              onChange={e => setProfile({...profile, race: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
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
            <label className="block text-sm font-medium text-gray-700">Veteran Status</label>
            <select
              value={profile.veteranStatus || ''}
              onChange={e => setProfile({...profile, veteranStatus: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="I am not a protected veteran">I am not a protected veteran</option>
              <option value="I identify as one or more of the classifications of a protected veteran">I identify as one or more of the classifications of a protected veteran</option>
              <option value="I don't wish to answer">I don't wish to answer</option>
            </select>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Disability Status</label>
            <select
              value={profile.disabilityStatus || ''}
              onChange={e => setProfile({...profile, disabilityStatus: e.target.value})}
              className="mt-1 block w-full shadow-sm sm:text-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md p-2 border"
            >
              <option value="">Select...</option>
              <option value="Yes, I have a disability (or previously had a disability)">Yes, I have a disability</option>
              <option value="No, I don't have a disability">No, I don't have a disability</option>
              <option value="I don't wish to answer">I don't wish to answer</option>
            </select>
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
