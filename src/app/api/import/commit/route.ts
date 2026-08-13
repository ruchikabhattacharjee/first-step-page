import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { lineItemsTotal, EXPENSE_CATEGORIES, type LineItem } from '@/lib/constants';

export const runtime = 'nodejs';

async function nextInvoiceNumber(ownerId: string, taken: Set<string>): Promise<string> {
  const invoices = await prisma.invoice.findMany({ where: { ownerId }, select: { invoiceNumber: true } });
  let max = invoices.reduce((m, i) => {
    const n = parseInt(i.invoiceNumber.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  let num: string;
  do { num = `INV-${String(++max).padStart(4, '0')}`; } while (taken.has(num));
  taken.add(num);
  return num;
}

type Draft = {
  docType: 'INVOICE' | 'BILL';
  partyName: string;
  number?: string;
  issueDate: string;
  dueDate: string;
  category?: string;
  items: LineItem[];
  state?: string;
};

// Persist reviewed drafts: create/reuse the contact, then create each invoice
// or bill (DRAFT by default) under the current tenant.
export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;
  const ownerId = tenantOf(gate);

  const { drafts } = await req.json();
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return NextResponse.json({ error: 'No drafts to import' }, { status: 400 });
  }

  const takenInv = new Set<string>();
  let invoices = 0, bills = 0;
  const failures: string[] = [];

  for (const d of drafts as Draft[]) {
    try {
      const items: LineItem[] = (d.items || []).filter((it) => it.desc && (it.qty || 0) > 0);
      if (items.length === 0) throw new Error('no valid line items');
      const total = Math.round(lineItemsTotal(items));
      const dueDate = d.dueDate ? new Date(d.dueDate) : new Date();
      const issue = d.issueDate ? new Date(d.issueDate) : new Date();
      const partyName = (d.partyName || '').trim() || 'Unknown';

      if (d.docType === 'INVOICE') {
        const contact = (await prisma.contact.findFirst({ where: { ownerId, name: partyName } }))
          ?? (await prisma.contact.create({ data: { ownerId, name: partyName, type: 'CUSTOMER' } }));
        await prisma.invoice.create({
          data: {
            ownerId,
            invoiceNumber: await nextInvoiceNumber(ownerId, takenInv),
            customerId: contact.id,
            issueDate: issue,
            dueDate,
            state: d.state === 'SENT' ? 'SENT' : 'DRAFT',
            items: JSON.stringify(items),
            totalAmount: total,
          },
        });
        invoices++;
      } else {
        const contact = (await prisma.contact.findFirst({ where: { ownerId, name: partyName } }))
          ?? (await prisma.contact.create({ data: { ownerId, name: partyName, type: 'VENDOR' } }));
        const category = EXPENSE_CATEGORIES.includes((d.category || '') as any) ? d.category! : 'Other';
        await prisma.bill.create({
          data: {
            ownerId,
            billNumber: (d.number || '').trim() || `BILL-${Date.now().toString().slice(-6)}`,
            vendorId: contact.id,
            billDate: issue,
            dueDate,
            category,
            state: d.state === 'PENDING' ? 'PENDING' : 'DRAFT',
            items: JSON.stringify(items),
            totalAmount: total,
          },
        });
        bills++;
      }
    } catch (err: any) {
      failures.push(`${d.partyName || 'document'}: ${err?.message || 'failed'}`);
    }
  }

  return NextResponse.json({ success: true, invoices, bills, failures });
}
