import { prisma } from './src/db/prisma';

async function main() {
  try {
    await prisma.application.findMany({
      where: {
        status: { notIn: ['Rejected', 'Withdrawn', 'Closed'] }
      },
      include: {
        job: {
          include: { company: true }
        }
      }
    });
  } catch (e) {
    console.log(e);
  }
}
main();
