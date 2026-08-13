import { prisma } from './prisma';
import { EXPENSE_CATEGORIES } from './constants';

// ---- seeded RNG so each business regenerates a consistent ledger ----
function makeRng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const rnd = (r: Rng, min: number, max: number) => Math.round(min + r() * (max - min));
const pick = <T,>(r: Rng, arr: T[]): T => arr[Math.floor(r() * arr.length)];
const daysAgo = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const daysAhead = (n: number) => daysAgo(-n);

// Industries that primarily bill clients via invoices vs. take daily cash sales.
const INVOICE_HEAVY = ['Professional Services', 'Manufacturing', 'Construction', 'Freelancer'];
const SCALE: Record<string, number> = {
  'Food & Beverage': 1, 'Retail': 1.4, 'Manufacturing': 2.5, 'Professional Services': 1.8,
  'Freelancer': 0.4, 'Healthcare': 1.6, 'Education': 1.2, 'Construction': 3, 'Other': 1,
};

// Industry-tailored contact pools so each business gets believable, relevant
// customers and vendors (not the same generic six for everyone).
const INDUSTRY_CUSTOMERS: Record<string, string[]> = {
  'Food & Beverage': ['The Corner Bistro', 'Sunrise Catering Co', 'Green Leaf Cafe', 'Urban Eats', 'Spice Route Diner', 'Daily Grind Coffee', 'Banquet Bookings Ltd', 'Festive Events Co'],
  'Retail': ['Metro Mart', 'Trendline Apparel', 'QuickShop Retail', 'FashionHub Stores', 'HomeStyle Outlet', 'Gadget Galaxy', 'Daily Needs Bazaar', 'Urban Threads'],
  'Manufacturing': ['Apex Industries', 'BuildWell Corp', 'Precision Parts Ltd', 'Northstar Manufacturing', 'IronClad Engineering', 'Summit Fabricators', 'Vertex Components', 'Pioneer Tooling'],
  'Professional Services': ['Lawson & Co', 'Meridian Consulting', 'BrightPath Advisory', 'Quantum Partners', 'Sterling Associates', 'Vantage Solutions', 'Clarity Consultants', 'Keystone Advisors'],
  'Freelancer': ['Studio Nova', 'Pixel Forge', 'Bright Media', 'Indie Labs', 'Crafted Co', 'Wavelength Design', 'Northlight Studio', 'Maker House'],
  'Healthcare': ['CarePoint Clinic', 'Wellness First', 'MediCore Hospital', 'LifeLine Diagnostics', 'Sunrise Health', 'Vital Care Centre', 'PrimeMed Labs', 'GreenCross Pharmacy'],
  'Education': ['BrightMinds Academy', 'Scholars Hub', 'NextGen Tutors', 'Pinnacle Institute', 'LearnSphere', 'EduCare Centre', 'Wisdom Tree School', 'Apex Coaching'],
  'Construction': ['BuildRight Developers', 'Skyline Constructions', 'Foundation Partners', 'UrbanForm Builders', 'Cornerstone Projects', 'SolidBase Contractors', 'Horizon Estates', 'Apex Infra'],
  'Other': ['Acme Corp', 'Globex Ltd', 'Initech Solutions', 'Umbrella Group', 'Northwind Traders', 'Vertex Co', 'Blue Orchid Events', 'Metro Group'],
};

const INDUSTRY_VENDORS: Record<string, string[]> = {
  'Food & Beverage': ['Fresh Roasters Supply', 'Farm2Table Produce', 'CoolChain Logistics', 'PackRight Containers', 'CityGas Utilities', 'BrewMaster Equipment', 'Dairy Direct', 'CleanPro Services'],
  'Retail': ['Wholesale Depot', 'TrendSource Imports', 'PackRight Containers', 'Skyline Logistics', 'POS Systems Inc', 'ShelfPro Fixtures', 'AdReach Media', 'CityGas Utilities'],
  'Manufacturing': ['RawMetal Suppliers', 'PowerGrid Utilities', 'Heavy Logistics Co', 'ToolTech Equipment', 'SafetyFirst Gear', 'ChemSource Ltd', 'Precision Castings', 'Industrial Lubricants'],
  'Professional Services': ['CloudStack Hosting', 'OfficeHub Rentals', 'PrintPro Services', 'LegalDocs Co', 'TalentBridge Staffing', 'NextGen Software', 'AdReach Media', 'CityPower Utilities'],
  'Freelancer': ['Adobe Subscriptions', 'CloudStack Hosting', 'CoWork Spaces', 'StockAsset Market', 'GearUp Equipment', 'FreelanceTools Inc', 'CityNet Broadband', 'PrintPro Services'],
  'Healthcare': ['MedSupply Distributors', 'PharmaSource Ltd', 'BioWaste Services', 'LabEquip Co', 'CityPower Utilities', 'Sterile Solutions', 'CareSoft Systems', 'OxyGen Supplies'],
  'Education': ['BookWorld Distributors', 'EduTech Software', 'Campus Utilities', 'StationeryHub', 'FurniSchool Supplies', 'CleanPro Services', 'TransitFleet Co', 'PrintPro Services'],
  'Construction': ['CementCore Suppliers', 'SteelLine Traders', 'HeavyGear Rentals', 'SiteSafe Equipment', 'PowerGrid Utilities', 'Aggregate Supplies Co', 'CraneTech Logistics', 'TimberYard Ltd'],
  'Other': ['Prime Supplies Co', 'Skyline Logistics', 'NextGen Software', 'AdReach Media', 'City Utilities', 'OfficeHub Rentals', 'CloudStack Hosting', 'CleanPro Services'],
};

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);
// Deterministically pick `count` distinct names from a pool (seeded shuffle).
const pickDistinct = (r: Rng, pool: string[], count: number): string[] => {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
};

const J = (items: any[]) => JSON.stringify(items);

/**
 * Wipe the owner's existing ledger and generate a fresh, believable 90-day
 * history tailored to their industry. Returns the computed current balance.
 */
export async function generateLedger(ownerId: string, industry: string): Promise<{ bankBalance: number; transactionCount: number }> {
  const r = makeRng(ownerId);
  const scale = SCALE[industry] ?? 1;
  const invoiceHeavy = INVOICE_HEAVY.includes(industry);

  // 1. Clear existing business data for this owner (idempotent regeneration).
  await prisma.transaction.deleteMany({ where: { ownerId } });
  await prisma.invoice.deleteMany({ where: { ownerId } });
  await prisma.bill.deleteMany({ where: { ownerId } });
  await prisma.contact.deleteMany({ where: { ownerId } });
  await prisma.budget.deleteMany({ where: { ownerId } });

  // 2. Contacts (customers + vendors) — tailored to the business's industry and
  // varied per tenant via the seeded shuffle.
  const customerPool = INDUSTRY_CUSTOMERS[industry] ?? INDUSTRY_CUSTOMERS.Other;
  const vendorPool = INDUSTRY_VENDORS[industry] ?? INDUSTRY_VENDORS.Other;

  const customers = [] as { id: string; name: string }[];
  for (const name of pickDistinct(r, customerPool, 4)) {
    customers.push(await prisma.contact.create({
      data: { ownerId, name, type: 'CUSTOMER', email: `accounts@${slug(name)}.com`, phone: `+9198${rnd(r, 10000000, 99999999)}` },
    }));
  }
  const vendors = [] as { id: string; name: string }[];
  for (const name of pickDistinct(r, vendorPool, 5)) {
    vendors.push(await prisma.contact.create({
      data: { ownerId, name, type: 'VENDOR', email: `billing@${slug(name)}.com`, phone: `+9197${rnd(r, 10000000, 99999999)}` },
    }));
  }

  type Txn = { ownerId: string; date: Date; amount: number; description: string; type: string; category?: string; tag: string };
  const txns: Txn[] = [];

  // 3a. Daily sales (cash businesses) or weekly project income (invoice businesses).
  const dailyAvg = Math.round((invoiceHeavy ? 6000 : 16000) * scale);
  for (let d = 90; d >= 0; d--) {
    const date = daysAgo(d);
    const dow = date.getDay();
    const weekendBoost = dow === 0 || dow === 6 ? 1.3 : 1; // busier weekends for retail/F&B
    if (invoiceHeavy && d % 1 !== 0) continue;
    const amount = Math.round(dailyAvg * (0.55 + r() * 0.9) * weekendBoost);
    if (amount <= 0) continue;
    txns.push({ ownerId, date, amount, description: invoiceHeavy ? 'Service income' : 'Daily Sales (POS/UPI)', type: 'IN', category: 'Sales', tag: 'OPERATING' });
  }

  // 3b. Recurring monthly operating outflows.
  const rent = Math.round(60000 * scale);
  const salaries = Math.round(120000 * scale);
  const utilities = Math.round(14000 * scale);
  const software = Math.round(8000 * scale);
  for (const monthOffset of [2, 1, 0]) {
    const base = monthOffset * 30;
    txns.push({ ownerId, date: daysAgo(base + 28), amount: rent, description: 'Office / Shop Rent', type: 'OUT', category: 'Rent', tag: 'OPERATING' });
    txns.push({ ownerId, date: daysAgo(base + 1), amount: salaries, description: 'Staff Salaries', type: 'OUT', category: 'Salaries', tag: 'OPERATING' });
    txns.push({ ownerId, date: daysAgo(base + 24), amount: utilities, description: 'Electricity & Water', type: 'OUT', category: 'Utilities', tag: 'OPERATING' });
    txns.push({ ownerId, date: daysAgo(base + 22), amount: software, description: 'SaaS Subscriptions', type: 'OUT', category: 'Software', tag: 'OPERATING' });
    txns.push({ ownerId, date: daysAgo(base + 12), amount: rnd(r, 6000, 22000) * Math.max(1, Math.round(scale)), description: 'Marketing Campaign', type: 'OUT', category: 'Marketing', tag: 'OPERATING' });
  }

  // 3c. Investing & Financing activity.
  txns.push({ ownerId, date: daysAgo(50), amount: Math.round(180000 * scale), description: 'Equipment Purchase', type: 'OUT', category: 'Capital', tag: 'INVESTING' });
  txns.push({ ownerId, date: daysAgo(78), amount: Math.round(500000 * scale), description: 'Owner Capital Injection', type: 'IN', category: 'Equity', tag: 'FINANCING' });
  for (const monthOffset of [2, 1, 0]) {
    txns.push({ ownerId, date: daysAgo(monthOffset * 30 + 15), amount: Math.round(35000 * scale), description: 'Business Loan EMI', type: 'OUT', category: 'Loan', tag: 'FINANCING' });
  }

  // 3d. A few named ad-hoc movements so the ledger reads like a real bank feed.
  for (const off of [62, 38, 16, 7]) {
    const c = pick(r, customers);
    txns.push({ ownerId, date: daysAgo(off), amount: rnd(r, 8000, 40000) * Math.max(1, Math.round(scale)), description: `Advance received — ${c.name}`, type: 'IN', category: 'Sales', tag: 'OPERATING' });
  }
  for (const off of [70, 44, 21, 9]) {
    const v = pick(r, vendors);
    txns.push({ ownerId, date: daysAgo(off), amount: rnd(r, 6000, 30000) * Math.max(1, Math.round(scale)), description: `Supplier restock — ${v.name}`, type: 'OUT', category: 'Raw Materials', tag: 'OPERATING' });
  }

  // 4. Invoices (AR) with mixed lifecycle states.
  const invAmt = () => (invoiceHeavy ? rnd(r, 80000, 260000) : rnd(r, 30000, 120000)) * (scale > 1 ? 1 : 1);
  let invSeq = 1;
  const mkInv = async (state: string, issue: Date, due: Date) => {
    const cust = pick(r, customers);
    const amount = invAmt();
    const inv = await prisma.invoice.create({
      data: {
        ownerId, invoiceNumber: `INV-${String(invSeq++).padStart(4, '0')}`, customerId: cust.id,
        issueDate: issue, dueDate: due, state, totalAmount: amount,
        paidDate: state === 'PAID' ? due : null,
        items: J([{ desc: 'Goods / Services', qty: 1, unitPrice: amount, taxRate: 0 }]),
      },
    });
    if (state === 'PAID') {
      await prisma.transaction.create({
        data: { ownerId, date: due, amount, description: `Collection from ${cust.name} — ${inv.invoiceNumber}`, type: 'IN', category: 'Collections', tag: 'OPERATING', invoiceId: inv.id },
      });
    }
  };
  await mkInv('PAID', daysAgo(40), daysAgo(20));
  await mkInv('PAID', daysAgo(30), daysAgo(10));
  await mkInv('OVERDUE', daysAgo(45), daysAgo(15)); // 15 days overdue → yellow
  await mkInv('OVERDUE', daysAgo(80), daysAgo(50)); // 50 days overdue → orange
  await mkInv('SENT', daysAgo(5), daysAhead(10));
  await mkInv('SENT', daysAgo(2), daysAhead(25));
  await mkInv('DRAFT', daysAgo(1), daysAhead(20));

  // 5. Bills (AP) with mixed lifecycle states.
  let billSeq = 1;
  const mkBill = async (state: string, category: string, billDate: Date, due: Date, amount: number) => {
    const v = pick(r, vendors);
    const bill = await prisma.bill.create({
      data: {
        ownerId, billNumber: `BILL-${String(billSeq++).padStart(4, '0')}`, vendorId: v.id,
        billDate, dueDate: due, category, state, totalAmount: amount,
        paidDate: state === 'PAID' ? due : null,
        items: J([{ desc: category, qty: 1, unitPrice: amount, taxRate: 0 }]),
      },
    });
    if (state === 'PAID') {
      await prisma.transaction.create({
        data: { ownerId, date: due, amount, description: `Payment to ${v.name} — ${bill.billNumber}`, type: 'OUT', category, tag: 'OPERATING', billId: bill.id },
      });
    }
  };
  await mkBill('PAID', 'Raw Materials', daysAgo(35), daysAgo(20), Math.round(75000 * scale));
  await mkBill('PENDING', 'Raw Materials', daysAgo(4), daysAhead(10), Math.round(82000 * scale));
  await mkBill('PENDING', 'Software', daysAgo(2), daysAhead(6), Math.round(18000 * scale));
  await mkBill('OVERDUE', 'Utilities', daysAgo(40), daysAgo(12), Math.round(26000 * scale)); // yellow
  await mkBill('OVERDUE', 'Marketing', daysAgo(75), daysAgo(45), Math.round(48000 * scale)); // orange
  await mkBill('DRAFT', 'Other', daysAgo(1), daysAhead(15), Math.round(12000 * scale));

  // 6. Bulk-insert all the standalone transactions.
  await prisma.transaction.createMany({ data: txns });

  // 7. Budgets for the current month across standard categories.
  const now = new Date();
  const budgetTargets: Record<string, number> = {
    Rent: rent, Salaries: salaries, Utilities: utilities, Software: software,
    'Raw Materials': Math.round(90000 * scale), Marketing: Math.round(20000 * scale), Other: Math.round(15000 * scale),
  };
  await prisma.budget.createMany({
    data: EXPENSE_CATEGORIES.map((c) => ({ ownerId, month: now.getMonth() + 1, year: now.getFullYear(), category: c, amount: budgetTargets[c] ?? 10000 })),
  });

  // 8. Recompute the confirmed bank balance: opening + net flows.
  const all = await prisma.transaction.findMany({ where: { ownerId }, select: { amount: true, type: true } });
  const net = all.reduce((s, t) => s + (t.type === 'IN' ? t.amount : -t.amount), 0);
  const opening = Math.round(300000 * scale);
  const bankBalance = opening + net;

  // Outstanding receivables/payables snapshot for the opening baseline.
  const openInvoices = await prisma.invoice.findMany({ where: { ownerId, state: { in: ['SENT', 'OVERDUE'] } }, select: { totalAmount: true } });
  const openBills = await prisma.bill.findMany({ where: { ownerId, state: { in: ['PENDING', 'OVERDUE'] } }, select: { totalAmount: true } });

  await prisma.user.update({
    where: { id: ownerId },
    data: {
      bankBalance,
      openingReceivables: openInvoices.reduce((s, i) => s + i.totalAmount, 0),
      openingPayables: openBills.reduce((s, b) => s + b.totalAmount, 0),
      setupComplete: true,
    },
  });

  return { bankBalance, transactionCount: all.length };
}
