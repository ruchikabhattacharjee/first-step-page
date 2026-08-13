import { NextRequest, NextResponse } from 'next/server';
import { tenantOf } from '@/lib/auth';
import { requireWriter } from '@/lib/rbac';
import { extractFromPdf } from '@/lib/extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Accepts up to 10 PDF uploads, extracts structured invoice/bill drafts from
// each (text layer first, OCR fallback), and returns them WITHOUT saving.
export async function POST(req: NextRequest) {
  const gate = await requireWriter();
  if (gate instanceof NextResponse) return gate;

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'Expected a multipart upload' }, { status: 400 });

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Please upload at most ${MAX_FILES} files at once.` }, { status: 400 });

  const drafts = [];
  const errors: { fileName: string; error: string }[] = [];

  for (const file of files) {
    try {
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        throw new Error('Only PDF files are supported');
      }
      if (file.size > MAX_BYTES) throw new Error('File exceeds the 10 MB limit');

      const buffer = Buffer.from(await file.arrayBuffer());
      const draft = await extractFromPdf(buffer, file.name, gate.businessName);
      drafts.push(draft);
    } catch (err: any) {
      errors.push({ fileName: file.name, error: err?.message || 'Could not read this PDF' });
    }
  }

  return NextResponse.json({ drafts, errors });
}
