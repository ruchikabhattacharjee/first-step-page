/**
 * Generates realistic sample invoice & bill PDFs into ./sample-docs so you can
 * test the "Upload PDF" import flow without hunting for real documents.
 *
 * Run: npm run gen:samples
 */
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'sample-docs');

type Item = { desc: string; qty: number; rate: number };
type Doc = {
  file: string;
  title: string; // "TAX INVOICE"
  kind: 'INVOICE' | 'BILL';
  number: string;
  date: string;
  dueDate: string;
  seller: string;
  sellerLine: string;
  buyer: string;
  buyerLine: string;
  category?: string;
  items: Item[];
  taxRate: number; // %
  note?: string;
};

const inr = (n: number) => 'Rs. ' + n.toLocaleString('en-IN');

// A handful of believable documents: vendor bills (AP) + sales invoices (AR).
const DOCS: Doc[] = [
  {
    file: 'bill-fresh-roasters.pdf',
    title: 'TAX INVOICE',
    kind: 'BILL',
    number: 'FRS/2026/0412',
    date: '12-Jun-2026',
    dueDate: '27-Jun-2026',
    seller: 'Fresh Roasters Supply Co.',
    sellerLine: '14 Industrial Estate, Pune 411019 · GSTIN 27ABCDE1234F1Z5',
    buyer: 'Cafe Beans',
    buyerLine: 'Brigade Road, Bengaluru 560001',
    category: 'Raw Materials',
    taxRate: 5,
    items: [
      { desc: 'Arabica Coffee Beans (kg)', qty: 40, rate: 1450 },
      { desc: 'Robusta Blend (kg)', qty: 25, rate: 980 },
      { desc: 'Filter Papers (box)', qty: 12, rate: 320 },
    ],
    note: 'Payment due within 15 days. Bank: HDFC 50100XXXXXX.',
  },
  {
    file: 'bill-city-utilities.pdf',
    title: 'INVOICE',
    kind: 'BILL',
    number: 'CU-APR-88231',
    date: '03-Jun-2026',
    dueDate: '18-Jun-2026',
    seller: 'City Power & Utilities',
    sellerLine: 'Utility Bhavan, Bengaluru 560002 · GSTIN 29CITYU9876P1Z2',
    buyer: 'Cafe Beans',
    buyerLine: 'Brigade Road, Bengaluru 560001',
    category: 'Utilities',
    taxRate: 18,
    items: [
      { desc: 'Electricity charges (May 2026)', qty: 1, rate: 18600 },
      { desc: 'Water & sewerage', qty: 1, rate: 3400 },
    ],
  },
  {
    file: 'bill-adreach-media.pdf',
    title: 'TAX INVOICE',
    kind: 'BILL',
    number: 'ARM-2026-1190',
    date: '20-Jun-2026',
    dueDate: '05-Jul-2026',
    seller: 'AdReach Media Pvt Ltd',
    sellerLine: 'WeWork Galaxy, Residency Rd, Bengaluru 560025 · GSTIN 29ADRCH4567K1Z9',
    buyer: 'Cafe Beans',
    buyerLine: 'Brigade Road, Bengaluru 560001',
    category: 'Marketing',
    taxRate: 18,
    items: [
      { desc: 'Instagram ad campaign (June)', qty: 1, rate: 25000 },
      { desc: 'Creative design retainer', qty: 1, rate: 12000 },
    ],
  },
  {
    file: 'invoice-sunrise-catering.pdf',
    title: 'TAX INVOICE',
    kind: 'INVOICE',
    number: 'INV-2026-0231',
    date: '18-Jun-2026',
    dueDate: '03-Jul-2026',
    seller: 'Cafe Beans',
    sellerLine: 'Brigade Road, Bengaluru 560001 · GSTIN 29CAFEB1111Q1Z0',
    buyer: 'Sunrise Catering Co',
    buyerLine: 'Koramangala, Bengaluru 560034',
    taxRate: 5,
    items: [
      { desc: 'Corporate event coffee service', qty: 1, rate: 48000 },
      { desc: 'Pastry platters (large)', qty: 8, rate: 1500 },
    ],
    note: 'Thank you for your business!',
  },
  {
    file: 'invoice-the-corner-bistro.pdf',
    title: 'INVOICE',
    kind: 'INVOICE',
    number: 'INV-2026-0237',
    date: '24-Jun-2026',
    dueDate: '24-Jul-2026',
    seller: 'Cafe Beans',
    sellerLine: 'Brigade Road, Bengaluru 560001 · GSTIN 29CAFEB1111Q1Z0',
    buyer: 'The Corner Bistro',
    buyerLine: 'Indiranagar, Bengaluru 560038',
    taxRate: 5,
    items: [
      { desc: 'Wholesale roasted beans (kg)', qty: 60, rate: 1200 },
      { desc: 'Branded cups (carton)', qty: 10, rate: 850 },
    ],
  },
];

function render(doc: Doc): Promise<void> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(path.join(OUT_DIR, doc.file));
    pdf.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);

    const subtotal = doc.items.reduce((s, it) => s + it.qty * it.rate, 0);
    const tax = Math.round((subtotal * doc.taxRate) / 100);
    const total = subtotal + tax;

    // Header
    pdf.fontSize(22).fillColor('#1e293b').text(doc.title, { align: 'right' });
    pdf.moveDown(0.2);
    pdf.fontSize(10).fillColor('#64748b').text(`${doc.number}`, { align: 'right' });
    pdf.moveDown(1);

    // Seller block
    pdf.fillColor('#0f172a').fontSize(14).text(doc.seller);
    pdf.fillColor('#64748b').fontSize(9).text(doc.sellerLine);
    pdf.moveDown(1);

    // Meta + Bill To
    const top = pdf.y;
    pdf.fontSize(10).fillColor('#0f172a');
    pdf.text(`Invoice No: ${doc.number}`, 50, top);
    pdf.text(`Invoice Date: ${doc.date}`, 50, top + 15);
    pdf.text(`Due Date: ${doc.dueDate}`, 50, top + 30);
    if (doc.category) pdf.text(`Category: ${doc.category}`, 50, top + 45);

    pdf.fillColor('#64748b').fontSize(9).text('BILL TO', 330, top);
    pdf.fillColor('#0f172a').fontSize(11).text(doc.buyer, 330, top + 13);
    pdf.fillColor('#64748b').fontSize(9).text(doc.buyerLine, 330, top + 28, { width: 215 });

    pdf.moveDown(doc.category ? 4 : 3.5);

    // Items table
    let y = pdf.y + 10;
    const cols = { desc: 50, qty: 330, rate: 390, amt: 470 };
    pdf.fontSize(9).fillColor('#64748b');
    pdf.text('DESCRIPTION', cols.desc, y);
    pdf.text('QTY', cols.qty, y);
    pdf.text('RATE', cols.rate, y);
    pdf.text('AMOUNT', cols.amt, y);
    y += 14;
    pdf.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 8;

    pdf.fontSize(10).fillColor('#0f172a');
    for (const it of doc.items) {
      const amt = it.qty * it.rate;
      pdf.text(it.desc, cols.desc, y, { width: 270 });
      pdf.text(String(it.qty), cols.qty, y);
      pdf.text(inr(it.rate), cols.rate, y);
      pdf.text(inr(amt), cols.amt, y);
      y += 22;
    }

    y += 6;
    pdf.moveTo(330, y).lineTo(545, y).strokeColor('#e2e8f0').stroke();
    y += 10;
    pdf.fontSize(10).fillColor('#0f172a');
    pdf.text('Subtotal', 390, y); pdf.text(inr(subtotal), cols.amt, y);
    y += 18;
    pdf.text(`GST (${doc.taxRate}%)`, 390, y); pdf.text(inr(tax), cols.amt, y);
    y += 20;
    pdf.fontSize(12).fillColor('#0f172a').text('TOTAL', 390, y);
    pdf.text(inr(total), cols.amt, y);

    if (doc.note) {
      pdf.moveDown(3);
      pdf.fontSize(9).fillColor('#94a3b8').text(doc.note, 50);
    }

    pdf.end();
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const doc of DOCS) {
    await render(doc);
    console.log('Wrote', doc.file);
  }
  console.log(`\nDone. ${DOCS.length} sample PDFs in ./sample-docs`);
}

main().catch((e) => { console.error(e); process.exit(1); });
