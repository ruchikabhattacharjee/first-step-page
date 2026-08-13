import { PDFParse } from 'pdf-parse';
import { EXPENSE_CATEGORIES, type LineItem } from './constants';

export type Confidence = 'high' | 'medium' | 'low';

export type ExtractedDraft = {
  fileName: string;
  method: 'text' | 'ocr';
  docType: 'INVOICE' | 'BILL';
  partyName: string; // customer (for INVOICE) or vendor (for BILL)
  number: string;
  issueDate: string; // yyyy-mm-dd
  dueDate: string; // yyyy-mm-dd
  category: string; // bills only; '' for invoices
  currency: string;
  items: LineItem[];
  total: number;
  confidence: Record<string, Confidence>;
  warnings: string[];
};

// ---------- text extraction (text layer first, OCR fallback) ----------

/** Pull raw text from a PDF buffer. Uses the embedded text layer when present;
 *  falls back to Tesseract OCR for scanned/image-only PDFs. */
export async function extractText(buffer: Buffer): Promise<{ text: string; method: 'text' | 'ocr' }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const res = await parser.getText();
    const text = (res.text || '').trim();
    // Enough real text → use it directly (fast + accurate).
    if (text.replace(/\s/g, '').length >= 40) {
      return { text, method: 'text' };
    }
    // Otherwise the PDF is likely a scan — OCR the rendered pages.
    const ocr = await ocrPdf(parser);
    return { text: ocr, method: 'ocr' };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function ocrPdf(parser: PDFParse): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const shot = await parser.getScreenshot();
  const worker = await createWorker('eng');
  try {
    const parts: string[] = [];
    for (const page of shot.pages.slice(0, 5)) {
      const img: Buffer = (page as any).data;
      const { data } = await worker.recognize(img);
      parts.push(data.text);
    }
    return parts.join('\n').trim();
  } finally {
    await worker.terminate();
  }
}

// ---------- helpers ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const num = (s: string) => Number(String(s).replace(/[^\d.]/g, '')) || 0;

/** Parse common date shapes to yyyy-mm-dd; '' if unparseable. */
function toISO(raw: string): string {
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ](\d{2,4})$/); // 12-Jun-2026
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return `${pad4(m[3])}-${pad2(mon)}-${pad2(+m[1])}`;
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // 12/06/2026 (dd/mm/yyyy)
  if (m) return `${pad4(m[3])}-${pad2(+m[2])}-${pad2(+m[1])}`;
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // already ISO
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  return '';
}
const pad2 = (n: number | string) => String(n).padStart(2, '0');
const pad4 = (y: string | number) => { const n = +y; return String(n < 100 ? 2000 + n : n); };

function detectCurrency(text: string): string {
  if (/₹|\bRs\.?\b|\bINR\b/i.test(text)) return 'INR';
  if (/\bUSD\b|\$/.test(text)) return 'USD';
  if (/\bGBP\b|£/.test(text)) return 'GBP';
  if (/\bAUD\b/.test(text)) return 'AUD';
  return 'INR';
}

function matchCategory(raw: string): string {
  const r = raw.trim().toLowerCase();
  for (const c of EXPENSE_CATEGORIES) if (c.toLowerCase() === r) return c;
  for (const c of EXPENSE_CATEGORIES) if (r.includes(c.toLowerCase())) return c;
  return 'Other';
}

// ---------- the parser ----------

/**
 * Turn raw invoice/bill text into a structured draft. `ourBusiness` is the
 * logged-in user's business name — it decides whether the document is a BILL we
 * received (we are "Bill To") or an INVOICE we issued (we are the seller).
 */
export function parseDocument(text: string, fileName: string, method: 'text' | 'ocr', ourBusiness: string): ExtractedDraft {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const confidence: Record<string, Confidence> = {};
  const warnings: string[] = [];
  const lower = text.toLowerCase();
  const ours = (ourBusiness || '').trim().toLowerCase();

  // --- number ---
  let number = '';
  let m = text.match(/Invoice\s*(?:No|Number|#)\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9/\-]+)/i)
    || text.match(/\b(?:INV|BILL)[-/][A-Za-z0-9/\-]+/i);
  if (m) { number = (m[1] || m[0]).trim(); confidence.number = 'high'; }
  else { number = ''; confidence.number = 'low'; warnings.push('Invoice number not found'); }

  // --- dates ---
  const issRaw = (text.match(/Invoice\s*Date\s*[:.]?\s*([0-9A-Za-z/\- ]+?)(?:\n|$)/i)
    || text.match(/\bDate\s*[:.]?\s*([0-9A-Za-z/\- ]+?)(?:\n|$)/i))?.[1] || '';
  const dueRaw = text.match(/Due\s*Date\s*[:.]?\s*([0-9A-Za-z/\- ]+?)(?:\n|$)/i)?.[1] || '';
  const issueDate = toISO(issRaw);
  let dueDate = toISO(dueRaw);
  confidence.issueDate = issueDate ? 'high' : 'low';
  if (!issueDate) warnings.push('Issue date not found');
  if (!dueDate) {
    // default: 15 days after issue (or today)
    const base = issueDate ? new Date(issueDate) : new Date();
    base.setDate(base.getDate() + 15);
    dueDate = base.toISOString().slice(0, 10);
    confidence.dueDate = 'low';
  } else confidence.dueDate = 'high';

  // --- doc type + party ---
  // "Bill To" party:
  const billToIdx = lines.findIndex((l) => /bill\s*to/i.test(l));
  const billToParty = billToIdx >= 0 ? (lines[billToIdx].replace(/.*bill\s*to\s*[:]?/i, '').trim() || lines[billToIdx + 1] || '') : '';
  // Seller = the prominent org line near the top (before "Invoice No").
  const noIdx = lines.findIndex((l) => /invoice\s*(no|number|#)/i.test(l));
  const seller = lines.slice(0, noIdx >= 0 ? noIdx : 4).find((l) => l.length > 3 && !/^(tax\s*)?invoice$/i.test(l) && !/^[A-Z0-9/\-]+$/.test(l) && !/gstin|invoice/i.test(l)) || '';

  let docType: 'INVOICE' | 'BILL';
  let partyName: string;
  if (ours && billToParty.toLowerCase().includes(ours)) {
    docType = 'BILL'; partyName = seller; confidence.docType = 'high';
  } else if (ours && seller.toLowerCase().includes(ours)) {
    docType = 'INVOICE'; partyName = billToParty; confidence.docType = 'high';
  } else {
    // Can't anchor on our business — assume a received bill (most common upload).
    docType = 'BILL'; partyName = seller || billToParty; confidence.docType = 'low';
    warnings.push('Could not confirm document type from your business name');
  }
  confidence.partyName = partyName ? (confidence.docType === 'high' ? 'high' : 'medium') : 'low';
  if (!partyName) warnings.push('Counterparty name not found');

  // --- category (bills) ---
  let category = '';
  if (docType === 'BILL') {
    const catRaw = text.match(/Category\s*[:.]?\s*([A-Za-z &]+)/i)?.[1];
    category = catRaw ? matchCategory(catRaw) : guessCategory(lower);
    confidence.category = catRaw ? 'high' : 'low';
  }

  // --- line items ---
  const taxRate = num((text.match(/GST\s*\(?\s*([\d.]+)\s*%/i) || [])[1] || '0');
  const items: LineItem[] = [];
  for (const l of lines) {
    // "Description ... 40 Rs. 1,450 Rs. 58,000"
    const im = l.match(/^(.+?)\s+(\d+)\s+(?:Rs\.?|₹|\$|£)?\s*([\d,]+(?:\.\d+)?)\s+(?:Rs\.?|₹|\$|£)?\s*([\d,]+(?:\.\d+)?)$/);
    if (im && !/subtotal|total|gst|tax/i.test(im[1])) {
      items.push({ desc: im[1].trim(), qty: num(im[2]), unitPrice: num(im[3]), taxRate });
    }
  }
  confidence.items = items.length ? 'high' : 'low';
  if (!items.length) {
    warnings.push('No line items detected — add them manually');
    items.push({ desc: 'Imported item', qty: 1, unitPrice: 0, taxRate });
  }

  // --- total ---
  const totalMatches = [...text.matchAll(/(?:Grand\s*)?Total\s*(?:Rs\.?|₹|\$|£|INR)?\s*([\d,]+(?:\.\d+)?)/gi)]
    .map((mm) => num(mm[1]))
    .filter((n) => n > 0);
  let total = totalMatches.length ? Math.max(...totalMatches) : 0;
  if (!total) {
    const sub = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    total = Math.round(sub * (1 + taxRate / 100));
    confidence.total = 'low';
    warnings.push('Total inferred from line items');
  } else confidence.total = 'high';

  return {
    fileName,
    method,
    docType,
    partyName,
    number,
    issueDate: issueDate || new Date().toISOString().slice(0, 10),
    dueDate,
    category,
    currency: detectCurrency(text),
    items,
    total,
    confidence,
    warnings,
  };
}

function guessCategory(lower: string): string {
  if (/electric|water|utility|power|gas/.test(lower)) return 'Utilities';
  if (/rent|lease/.test(lower)) return 'Rent';
  if (/salary|payroll|wages/.test(lower)) return 'Salaries';
  if (/ad|marketing|campaign|media|promo/.test(lower)) return 'Marketing';
  if (/software|saas|subscription|license|hosting/.test(lower)) return 'Software';
  if (/coffee|beans|material|supply|stock|goods|raw/.test(lower)) return 'Raw Materials';
  return 'Other';
}

/** Full pipeline: PDF buffer → structured draft. */
export async function extractFromPdf(buffer: Buffer, fileName: string, ourBusiness: string): Promise<ExtractedDraft> {
  const { text, method } = await extractText(buffer);
  return parseDocument(text, fileName, method, ourBusiness);
}
