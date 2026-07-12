import axios from 'axios';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:3001/api/';
  const base = envUrl.replace(/\/$/, '');
  return base.endsWith('/api') ? base + '/' : base + '/api/';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

export const fetchProfile = async () => {
  const res = await api.get('profile');
  return res.data;
};

export const updateProfile = async (data: any) => {
  const res = await api.put('profile', data);
  return res.data;
};

export const uploadResumePdf = async (formData: FormData) => {
  const res = await api.post('profile/resume-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const updateProfileKeywords = async (keywords: string[]) => {
  const res = await api.put('profile/keywords', { keywords });
  return res.data;
};

// ── Custom (learned) application fields ─────────────────────────────────────

export const fetchCustomFields = async () => {
  const res = await api.get('profile/custom-fields');
  return res.data;
};

export const updateCustomFieldValue = async (id: string, value: string) => {
  const res = await api.put(`profile/custom-fields/${id}`, { value });
  return res.data;
};

export const deleteCustomField = async (id: string) => {
  const res = await api.delete(`profile/custom-fields/${id}`);
  return res.data;
};

export const fetchDashboardSummary = async () => {
  const res = await api.get('applications/summary');
  return res.data;
};

export const fetchApplications = async (status?: string) => {
  const res = await api.get('applications', { params: status ? { status } : undefined });
  return res.data;
};

export const createApplication = async (data: { companyName: string; jobTitle: string; jobUrl?: string; location?: string; salaryRange?: string; status?: string; category?: string; notes?: string; dateApplied?: string }) => {
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

export const deleteApplication = async (appId: string) => {
  const res = await api.delete(`applications/${appId}`);
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

export const fetchJobListings = async (params?: Record<string, string | number>) => {
  const res = await api.get('job-listings', { params });
  return res.data;
};

export const fetchJobMatches = async () => {
  const res = await api.get('job-listings/matches');
  return res.data;
};

export const fetchCompanies = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}) => {
  const res = await api.get('companies', { params });
  return res.data;
};

export const fetchNewsCompanies = async (params?: {
  search?: string;
  searchIn?: string;
  status?: string;
  stages?: string;
  categories?: string;
  states?: string;
  foundedFrom?: string;
  foundedTo?: string;
  fundedWithinDays?: string;
  minFunding?: string;
  maxFunding?: string;
  favorites?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}) => {
  const res = await api.get('news-companies', { params });
  return res.data;
};

export const fetchNewsCompanyFacets = async () => {
  const res = await api.get('news-companies/facets');
  return res.data;
};

export const toggleNewsCompanyFavorite = async (id: string, favorite: boolean) => {
  const res = await api.post(`news-companies/${id}/favorite`, { favorite });
  return res.data;
};

export const fetchAdminUsers = async (params?: { search?: string; page?: number; limit?: number }) => {
  const res = await api.get('admin/users', { params });
  return res.data;
};

export const fetchAdminUserProfile = async (userId: string) => {
  const res = await api.get(`admin/users/${userId}/profile`);
  return res.data;
};

export const startImpersonation = async (userId: string) => {
  const res = await api.post(`admin/impersonate/${userId}`);
  return res.data;
};

export default api;
