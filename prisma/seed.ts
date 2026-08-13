import { prisma } from '../src/lib/prisma';
import { generateLedger } from '../src/lib/demoData';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Cleaning database...');
  await prisma.transaction.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.otpToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('Seeding users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // The business owner (Admin) — all demo data is scoped to this account.
  const admin = await prisma.user.create({
    data: {
      name: 'Sam Admin', businessName: 'Cafe Beans', email: 'admin@cafebeans.test',
      passwordHash, industry: 'Food & Beverage', country: 'India', currency: 'INR',
      fyStartMonth: 4, role: 'Admin', isVerified: true, setupComplete: true,
    },
  });

  // Team members share the owner's business via businessId.
  await prisma.user.create({
    data: {
      name: 'Alice Accountant', businessName: 'Cafe Beans', email: 'alice@cafebeans.test',
      passwordHash, industry: 'Food & Beverage', role: 'Accountant', isVerified: true,
      setupComplete: true, businessId: admin.id,
    },
  });
  await prisma.user.create({
    data: {
      name: 'Bob Viewer', businessName: 'Cafe Beans', email: 'bob@cafebeans.test',
      passwordHash, industry: 'Food & Beverage', role: 'Viewer', isVerified: true,
      setupComplete: true, businessId: admin.id,
    },
  });

  console.log('Generating 90-day ledger for Cafe Beans...');
  const result = await generateLedger(admin.id, admin.industry);

  console.log(`Database seeded. ${result.transactionCount} transactions, balance ₹${result.bankBalance.toLocaleString()}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
