import { prisma } from '../db/prisma';

export const jobService = {
  async createJobFromBrowser(input: {
    userId: string;
    title: string;
    companyName: string;
    jobUrl: string;
    location?: string;
    workMode?: string;
    source?: string;
    rawJobDescription?: string;
  }) {
    let company = await prisma.company.findUnique({ where: { name: input.companyName } });
    if (!company) {
      company = await prisma.company.create({ data: { name: input.companyName } });
    }

    const job = await prisma.job.create({
      data: {
        userId: input.userId,
        companyId: company.id,
        title: input.title,
        url: input.jobUrl,
        location: input.location,
        workMode: input.workMode,
        source: input.source,
        rawJobDescription: input.rawJobDescription
      }
    });

    return {
      jobId: job.id,
      created: true,
      message: "Job created successfully from browser."
    };
  },

  async searchJobs(filters: {
    query?: string;
    company?: string;
    title?: string;
    location?: string;
    minMatchScore?: number;
  }) {
    // This is a basic implementation. For advanced search, we'd use better full-text search.
    const whereClause: any = {};
    if (filters.company) {
      whereClause.company = { name: { contains: filters.company, mode: 'insensitive' } };
    }
    if (filters.title) {
      whereClause.title = { contains: filters.title, mode: 'insensitive' };
    }
    if (filters.location) {
      whereClause.location = { contains: filters.location, mode: 'insensitive' };
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      include: {
        company: true,
        applications: true,
        jobDescriptionAnalysis: true
      }
    });

    return jobs.map(j => ({
      jobId: j.id,
      applicationId: j.applications.length > 0 ? j.applications[0].id : undefined,
      companyName: j.company?.name || 'Unknown',
      jobTitle: j.title,
      location: j.location,
      matchScore: j.jobDescriptionAnalysis?.overallScore || undefined,
      jobUrl: j.url || undefined
    }));
  },
  
  async getJobById(id: string) {
    return prisma.job.findUnique({
      where: { id },
      include: { company: true, jobDescriptionAnalysis: true, applications: true }
    });
  },

  async getJobByUrl(url: string) {
    // Strip query parameters for better matching, unless they are essential.
    // For simplicity, we just do a direct match or contains.
    const baseUrl = url.split('?')[0];
    return prisma.job.findFirst({
      where: { 
        url: {
          contains: baseUrl,
          mode: 'insensitive'
        }
      },
      include: { company: true, applications: true }
    });
  }
};
