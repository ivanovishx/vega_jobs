import { prisma } from '../db/prisma';

export const applicationService = {
  async getApplicationStatus(applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, nextAction: true, nextActionDueDate: true, updatedAt: true }
    });
    if (!app) throw new Error("Application not found");
    return {
      applicationId: app.id,
      status: app.status,
      nextAction: app.nextAction,
      nextActionDueDate: app.nextActionDueDate,
      lastUpdated: app.updatedAt
    };
  },

  async updateApplicationStatus(input: { applicationId: string; status: string; note?: string; eventDate?: string }) {
    const updatedApp = await prisma.application.update({
      where: { id: input.applicationId },
      data: { status: input.status }
    });

    if (input.note || input.status) {
      await prisma.applicationEvent.create({
        data: {
          applicationId: input.applicationId,
          eventType: `Status changed to ${input.status}`,
          note: input.note,
          eventDate: input.eventDate ? new Date(input.eventDate) : new Date()
        }
      });
    }

    return {
      applicationId: updatedApp.id,
      updated: true,
      status: updatedApp.status,
      message: "Status updated successfully"
    };
  },

  async listActiveApplications(filters?: { status?: string | string[]; company?: string; minMatchScore?: number; dueSoon?: boolean }) {
    // 'To Apply' positions are bookmarks, not applications — excluded unless explicitly requested.
    const where: any = {
      status: { notIn: ['Rejected', 'Withdrawn', 'Closed', 'To Apply'] }
    };

    // Normalize: express query params arrive as a string for a single value
    const statusFilter = typeof filters?.status === 'string' ? [filters.status] : filters?.status;
    if (statusFilter && statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }
    
    // Simplification for MVP

    const apps = await prisma.application.findMany({
      where,
      include: {
        job: {
          include: { company: true }
        }
      }
    });

    return {
      applications: apps.map(app => ({
        applicationId: app.id,
        companyName: app.job.company?.name || 'Unknown',
        jobTitle: app.job.title,
        status: app.status,
        matchScore: app.matchScore || undefined,
        nextAction: app.nextAction || undefined,
        nextActionDueDate: app.nextActionDueDate?.toISOString(),
        jobUrl: app.job.url || undefined,
        location: app.job.location || undefined,
        salaryRange: app.job.salaryRange || undefined
      }))
    };
  },

  async addApplicationEvent(input: { applicationId: string; eventType: string; note: string; eventDate?: string; contactId?: string }) {
    const event = await prisma.applicationEvent.create({
      data: {
        applicationId: input.applicationId,
        eventType: input.eventType,
        note: input.note,
        eventDate: input.eventDate ? new Date(input.eventDate) : new Date(),
        contactId: input.contactId
      }
    });

    return {
      eventId: event.id,
      applicationId: input.applicationId,
      created: true
    };
  },

  async getFollowUpRecommendations(input: { daysSinceLastEvent?: number; status?: string[] }) {
    // Basic logic for MVP: find applications with no events in the last X days
    const apps = await prisma.application.findMany({
      where: {
        status: { in: ['Applied', 'Recruiter Screen', 'Hiring Manager Screen', 'Technical Interview'] }
      },
      include: {
        events: {
          orderBy: { eventDate: 'desc' },
          take: 1
        },
        job: { include: { company: true } }
      }
    });

    const recommendations = apps.map(app => {
      const lastEventDate = app.events.length > 0 ? app.events[0].eventDate : app.createdAt;
      return {
        applicationId: app.id,
        companyName: app.job.company?.name || 'Unknown',
        jobTitle: app.job.title,
        status: app.status,
        lastEventDate: lastEventDate.toISOString(),
        recommendedAction: `Follow up on ${app.status} status.`
      };
    });

    return { recommendations };
  },

  async summarizePipeline(candidateProfileId: string) {
    let profile;
    if (candidateProfileId.startsWith('mock-user-id')) {
      profile = await prisma.candidateProfile.findFirst();
    } else {
      profile = await prisma.candidateProfile.findUnique({ where: { id: candidateProfileId } });
    }
    if (!profile) throw new Error("Profile not found");

    const allApps = await prisma.application.findMany({
      where: { userId: profile.userId }
    });

    const totalApplications = allApps.length;
    const activeApplications = allApps.filter(a => !['Rejected', 'Withdrawn'].includes(a.status)).length;
    const interviews = allApps.filter(a => ['Recruiter Screen', 'Hiring Manager Screen', 'Technical Interview', 'Onsite'].includes(a.status)).length;
    const offers = allApps.filter(a => a.status === 'Offer').length;
    const rejections = allApps.filter(a => a.status === 'Rejected').length;
    
    const appsWithScores = allApps.filter(a => a.matchScore !== null && a.matchScore !== undefined);
    const averageMatchScore = appsWithScores.length > 0 
      ? Math.round(appsWithScores.reduce((sum, a) => sum + (a.matchScore || 0), 0) / appsWithScores.length)
      : 0;

    let pipelineHealth: "weak" | "moderate" | "strong" = "moderate";
    if (activeApplications > 10 && interviews > 2) pipelineHealth = "strong";
    if (activeApplications < 3 && interviews === 0) pipelineHealth = "weak";

    return {
      totalApplications,
      activeApplications,
      interviews,
      offers,
      rejections,
      averageMatchScore,
      applicationsNeedingFollowUp: 2, // mock
      pipelineHealth,
      recommendations: ["Apply to more roles matching your top skills."]
    };
  },

  async createApplication(input: {
    userId: string;
    companyName: string;
    jobTitle: string;
    jobUrl?: string;
    status: string;
    notes?: string;
    dateApplied?: string;
    location?: string;
    salaryRange?: string;
    rawJobDescription?: string;
  }) {
    let user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: input.userId,
          email: `${input.userId}@example.com`,
          name: 'Mock User'
        }
      });
    }

    // Duplicate Check
    if (input.jobUrl) {
      const existingJob = await prisma.job.findFirst({
        where: { url: input.jobUrl, userId: input.userId }
      });
      if (existingJob) {
        const existingApp = await prisma.application.findFirst({
          where: { jobId: existingJob.id, userId: input.userId }
        });
        if (existingApp && existingApp.status !== 'Rejected' && existingApp.status !== 'Withdrawn') {
          throw new Error("DUPLICATE_URL: You have already applied to this job URL.");
        }
      }
    }

    let company = await prisma.company.findUnique({ where: { name: input.companyName } });
    if (!company) {
      company = await prisma.company.create({ data: { name: input.companyName } });
    }

    const job = await prisma.job.create({
      data: {
        userId: input.userId,
        companyId: company.id,
        title: input.jobTitle,
        url: input.jobUrl,
        location: input.location,
        salaryRange: input.salaryRange,
        rawJobDescription: input.rawJobDescription
      }
    });

    const application = await prisma.application.create({
      data: {
        userId: input.userId,
        jobId: job.id,
        companyId: company.id,
        status: input.status || 'Applied',
        notes: input.notes,
        dateApplied: input.dateApplied ? new Date(input.dateApplied) : new Date()
      }
    });

    return {
      applicationId: application.id,
      created: true,
      message: "Application added successfully."
    };
  }
};
