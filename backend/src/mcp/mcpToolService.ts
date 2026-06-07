import { CreateJobSchema, AnalyzeJDSchema, GetAppStatusSchema, UpdateAppStatusSchema, ListActiveAppsSchema, SearchJobsSchema, GetCandidateProfileSchema, AddAppEventSchema, GetFollowUpRecsSchema, SummarizePipelineSchema } from './mcpSchemas';
import { jobService } from '../services/jobService';
import { jdAnalysisService } from '../services/jdAnalysisService';
import { applicationService } from '../services/applicationService';
import { candidateProfileService } from '../services/candidateProfileService';
import { z } from 'zod';

// Simplified binding service for MCP tool execution
export const mcpToolService = {
  async executeTool(toolName: string, args: any) {
    switch (toolName) {
      case 'create_job_from_browser': {
        const input = CreateJobSchema.parse(args);
        // Assuming user ID is derived from context in real app
        return jobService.createJobFromBrowser({ ...input, userId: 'mock-user-id' });
      }
      case 'analyze_job_description': {
        const input = AnalyzeJDSchema.parse(args);
        return jdAnalysisService.analyzeJobDescription(input);
      }
      case 'get_application_status': {
        const input = GetAppStatusSchema.parse(args);
        return applicationService.getApplicationStatus(input.applicationId);
      }
      case 'update_application_status': {
        const input = UpdateAppStatusSchema.parse(args);
        return applicationService.updateApplicationStatus(input);
      }
      case 'list_active_applications': {
        const input = ListActiveAppsSchema.parse(args);
        return applicationService.listActiveApplications(input);
      }
      case 'search_jobs': {
        const input = SearchJobsSchema.parse(args);
        return jobService.searchJobs(input);
      }
      case 'get_candidate_profile': {
        const input = GetCandidateProfileSchema.parse(args);
        return candidateProfileService.getCandidateProfile(input.candidateProfileId);
      }
      case 'add_application_event': {
        const input = AddAppEventSchema.parse(args);
        return applicationService.addApplicationEvent(input);
      }
      case 'get_follow_up_recommendations': {
        const input = GetFollowUpRecsSchema.parse(args);
        return applicationService.getFollowUpRecommendations(input);
      }
      case 'summarize_pipeline': {
        const input = SummarizePipelineSchema.parse(args);
        return applicationService.summarizePipeline(input.candidateProfileId);
      }
      default:
        throw new Error(`Tool ${toolName} not found`);
    }
  }
};
