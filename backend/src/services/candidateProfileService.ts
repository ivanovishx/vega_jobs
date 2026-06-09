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
      return prisma.candidateProfile.findFirst({
        include: { user: true }
      });
    }
    return prisma.candidateProfile.findUnique({
      where: { userId },
      include: { user: true }
    });
  },

  async updateCandidateProfile(id: string, data: any) {
    const { user, ...profileData } = data;
    
    // Remove auto-managed fields from generic update object
    delete profileData.id;
    delete profileData.userId;
    delete profileData.createdAt;
    delete profileData.updatedAt;

    const updateQuery: any = { ...profileData };

    if (user && (user.name || user.email)) {
      const userUpdate: any = {};
      if (user.name) userUpdate.name = user.name;
      if (user.email) userUpdate.email = user.email;
      updateQuery.user = { update: userUpdate };
    }

    return prisma.candidateProfile.update({
      where: { id },
      data: updateQuery,
      include: { user: true }
    });
  }
};
