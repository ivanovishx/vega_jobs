import { z } from 'zod';

export const CreateJobSchema = z.object({
  title: z.string(),
  companyName: z.string(),
  jobUrl: z.string(),
  location: z.string().optional(),
  workMode: z.enum(["remote", "hybrid", "onsite", "unknown"]).optional(),
  source: z.string().optional(),
  rawJobDescription: z.string().optional()
});

export const AnalyzeJDSchema = z.object({
  jobId: z.string().optional(),
  rawJobDescription: z.string(),
  candidateProfileId: z.string()
});

export const GetAppStatusSchema = z.object({
  applicationId: z.string()
});

export const UpdateAppStatusSchema = z.object({
  applicationId: z.string(),
  status: z.string(),
  note: z.string().optional(),
  eventDate: z.string().optional()
});

export const ListActiveAppsSchema = z.object({
  status: z.array(z.string()).optional(),
  company: z.string().optional(),
  minMatchScore: z.number().optional(),
  dueSoon: z.boolean().optional()
});

export const SearchJobsSchema = z.object({
  query: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  minMatchScore: z.number().optional()
});

export const GetCandidateProfileSchema = z.object({
  candidateProfileId: z.string()
});

export const AddAppEventSchema = z.object({
  applicationId: z.string(),
  eventType: z.string(),
  note: z.string(),
  eventDate: z.string().optional(),
  contactId: z.string().optional()
});

export const GetFollowUpRecsSchema = z.object({
  daysSinceLastEvent: z.number().optional(),
  status: z.array(z.string()).optional()
});

export const SummarizePipelineSchema = z.object({
  candidateProfileId: z.string()
});
