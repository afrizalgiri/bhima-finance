const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bhimafinance.com' },
    update: {},
    create: {
      name: 'Administrator',
      email: 'admin@bhimafinance.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  // Create company setting
  await prisma.companySetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'PT Bhima Finance',
      address: 'Jl. Sudirman No. 1, Jakarta Pusat, DKI Jakarta 10220',
      email: 'finance@bhimafinance.com',
      phone: '+62 21 1234 5678',
      website: 'https://bhimafinance.com',
      taxNumber: '01.234.567.8-901.000',
      bankName: 'Bank Central Asia (BCA)',
      bankAccount: '1234567890',
      bankHolder: 'PT Bhima Finance',
    },
  });

  console.log('Seed completed. Admin user:', admin.email);
  console.log('Default password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
