import { NextResponse } from 'next/server';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { generateLedger } from '@/lib/demoData';

// "Connect Your Bank" — instead of a mock alert, this generates a realistic
// 90-day transaction history (industry-aware) and imports it into the ledger.
export async function POST() {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  const result = await generateLedger(tenantOf(gate), gate.industry);
  return NextResponse.json({
    success: true,
    imported: result.transactionCount,
    bankBalance: result.bankBalance,
  });
}
