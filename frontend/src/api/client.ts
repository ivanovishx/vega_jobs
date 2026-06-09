import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001/api/';
  const base = envUrl.replace(/\/$/, '');
  return base.endsWith('/api') ? base + '/' : base + '/api/';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

export const fetchProfile = async () => {
  const res = await api.get('profile');
  return res.data;
};

export const updateProfile = async (data: any) => {
  const res = await api.put('profile', data);
  return res.data;
};

export const fetchDashboardSummary = async (profileId: string) => {
  const res = await api.get(`applications/summary?profileId=${profileId}`);
  return res.data;
};

export const fetchApplications = async (status?: string) => {
  const res = await api.get('applications', { params: status ? { status } : undefined });
  return res.data;
};

export const createApplication = async (data: { companyName: string; jobTitle: string; jobUrl?: string; location?: string; salaryRange?: string; status?: string; notes?: string; dateApplied?: string }) => {
  const res = await api.post('applications', data);
  return res.data;
};

export const autofillApplication = async (formData: FormData) => {
  const res = await api.post('applications/autofill', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const updateApplicationStatus = async (appId: string, status: string) => {
  const res = await api.put(`applications/${appId}/status`, { status });
  return res.data;
};

export const analyzeJobDescription = async (data: any) => {
  const res = await api.post('jd/analyze', data);
  return res.data;
};

export const getJobDetails = async (jobId: string) => {
  const res = await api.get(`jobs/${jobId}`);
  return res.data;
};

export default api;
