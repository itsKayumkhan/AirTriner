const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRaw`SELECT * FROM pg_policies WHERE tablename = 'training_offers'`
    .then(console.log)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
