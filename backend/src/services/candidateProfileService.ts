import { prisma } from '../db/prisma';

export const candidateProfileService = {
  async getCandidateProfile(id: string) {
    return prisma.candidateProfile.findUnique({
      where: { id },
      include: {
        user: true
      }
    });
  },

  async getCandidateProfileByUserId(userId: string) {
    if (userId.startsWith('mock-user-id')) {
      return prisma.candidateProfile.findFirst();
    }
    return prisma.candidateProfile.findUnique({
      where: { userId }
    });
  },

  async updateCandidateProfile(id: string, data: any) {
    return prisma.candidateProfile.update({
      where: { id },
      data
    });
  }
};
