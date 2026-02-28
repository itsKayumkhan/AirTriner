const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'notification_type'::regtype`.then(console.log).catch(console.error).finally(() => prisma.$disconnect());
