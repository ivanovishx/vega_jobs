import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create User
  const user = await prisma.user.upsert({
    where: { email: 'test@vega.com' },
    update: {},
    create: {
      email: 'test@vega.com',
      name: 'Vega Test User',
    }
  });

  // 2. Create Candidate Profile
  const profile = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      targetRoles: ['Technical Program Manager'],
      targetLocations: ['San Francisco, CA', 'Remote'],
      workAuthorization: 'US Citizen',
      yearsOfExperience: 8,
      coreSkills: [
        'Cross-functional leadership', 'Program roadmaps', 'NPI',
        'Manufacturing', 'Hardware/software integration', 'Supplier management'
      ],
      domainExperience: ['Robotics', 'Consumer hardware', 'AI/ML systems'],
      preferredWorkMode: 'hybrid',
      minimumSalary: 150000,
    }
  });

  // 3. Create Companies
  const company1 = await prisma.company.upsert({
    where: { name: 'RoboCorp' },
    update: {},
    create: { name: 'RoboCorp', domain: 'robocorp.com' }
  });

  const company2 = await prisma.company.upsert({
    where: { name: 'AI Hardware Inc' },
    update: {},
    create: { name: 'AI Hardware Inc', domain: 'aihw.inc' }
  });

  // 4. Create Jobs
  const job1 = await prisma.job.create({
    data: {
      userId: user.id,
      companyId: company1.id,
      title: 'Senior TPM, Robotics',
      location: 'San Francisco, CA',
      workMode: 'hybrid',
      salaryRange: '$160k - $200k',
      source: 'LinkedIn',
      rawJobDescription: `We are looking for a Senior TPM in Robotics.
Must have 5+ years of experience.
Skills required: Cross-functional leadership, NPI, supplier management, JIRA.
Domain: Robotics, consumer hardware.
This is a hybrid role in San Francisco. No sponsorship available.`
    }
  });

  const job2 = await prisma.job.create({
    data: {
      userId: user.id,
      companyId: company2.id,
      title: 'Software Engineer',
      location: 'Remote',
      workMode: 'remote',
      salaryRange: '$130k - $160k',
      source: 'Company Site',
      rawJobDescription: `Looking for a SWE to build our next generation API.
Skills: TypeScript, Node.js, Kubernetes, AWS.
3 years of experience. Remote OK.`
    }
  });

  // 5. Create Applications
  const app1 = await prisma.application.create({
    data: {
      userId: user.id,
      jobId: job1.id,
      companyId: company1.id,
      status: 'Recruiter Screen',
      matchScore: 92,
      nextAction: 'Prepare for recruiter call',
      nextActionDueDate: new Date(Date.now() + 86400000 * 2) // 2 days from now
    }
  });

  const app2 = await prisma.application.create({
    data: {
      userId: user.id,
      jobId: job2.id,
      companyId: company2.id,
      status: 'Applied',
      matchScore: 45
    }
  });

  // 6. Create Application Events
  await prisma.applicationEvent.create({
    data: {
      applicationId: app1.id,
      eventType: 'Applied',
      note: 'Applied via LinkedIn Easy Apply',
      eventDate: new Date(Date.now() - 86400000 * 5)
    }
  });

  await prisma.applicationEvent.create({
    data: {
      applicationId: app1.id,
      eventType: 'Status changed to Recruiter Screen',
      note: 'Recruiter emailed to schedule call',
      eventDate: new Date(Date.now() - 86400000 * 1)
    }
  });

  console.log("Seeding complete.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
