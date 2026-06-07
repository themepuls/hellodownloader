import type { PrismaClient } from '@hellodownloader/database';

const GUEST_EMAIL = 'guest@hellodownloader.local';

export async function getOrCreateGuestUser(prisma: Pick<PrismaClient, 'user'>) {
  let guest = await prisma.user.findUnique({ where: { email: GUEST_EMAIL } });
  if (!guest) {
    guest = await prisma.user.create({
      data: {
        email: GUEST_EMAIL,
        passwordHash: 'guest-not-used',
        name: 'Guest',
        plan: 'FREE',
      },
    });
  }
  return guest;
}
