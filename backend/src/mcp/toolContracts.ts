export const toolContracts = [
  {
    name: "create_job_from_browser",
    description: "Allows a Chrome extension or agent to save a job captured from a browser page.",
  },
  {
    name: "analyze_job_description",
    description: "Analyze pasted or captured JD text using deterministic parser and scoring engine.",
  },
  {
    name: "get_application_status",
    description: "Get current status and next action for a specific application.",
  },
  {
    name: "update_application_status",
    description: "Update application pipeline status from an agent or extension.",
  },
  {
    name: "list_active_applications",
    description: "Return active applications excluding rejected, withdrawn, and closed ones.",
  },
  {
    name: "search_jobs",
    description: "Search saved jobs and applications by keyword, company, title, skills, or location.",
  },
  {
    name: "get_candidate_profile",
    description: "Expose candidate profile to trusted agents for matching and personalization.",
  },
  {
    name: "add_application_event",
    description: "Add timeline events like follow-up sent, recruiter replied, interview scheduled, rejection received.",
  },
  {
    name: "get_follow_up_recommendations",
    description: "Find applications that need follow-up.",
  },
  {
    name: "summarize_pipeline",
    description: "Return a high-level summary of job search pipeline health.",
  }
];
