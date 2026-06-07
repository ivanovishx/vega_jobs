import { useEffect, useState } from 'react';
import { fetchProfile, updateProfile } from '../api/client';

export default function CandidateProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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
            <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
            <input
              type="number"
              value={profile.yearsOfExperience}
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
