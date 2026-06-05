import { hashPassword } from '../packages/auth-utils/dist/index.js';
import { PrismaClient } from '../packages/database/src/generated/prisma/index.js';

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL ?? 'admin@hellodownloader.local';
const password = process.env.ADMIN_PASSWORD ?? 'Admin123!';

const hash = await hashPassword(password);

const admin = await prisma.user.upsert({
  where: { email },
  update: { role: 'ADMIN', passwordHash: hash, name: 'Admin', plan: 'PRO', credits: 9999 },
  create: {
    email,
    passwordHash: hash,
    name: 'Admin',
    role: 'ADMIN',
    plan: 'PRO',
    credits: 9999,
  },
  select: { email: true, role: true, plan: true },
});

console.log('Admin ready:', admin);
console.log('Login at /login with:', email, '/', password);

await prisma.$disconnect();
