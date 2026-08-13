import { NextResponse } from 'next/server';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { generateReportPdf } from '@/lib/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Export a full business-snapshot PDF. Blocked for Viewers (requireWriter →
// Admin/Accountant only). Filename: <business>_<date>_<time>.pdf.
export async function GET() {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  const { buffer, fileName } = await generateReportPdf(tenantOf(gate), gate.name);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
