import PDFDocument from 'pdfkit';
import { prisma } from './prisma';
import { daysOverdue } from './constants';
import { dailyCashFlow, cashFlowStatement, budgetVsActuals, forecast } from './analytics';

// pdfkit's built-in Helvetica lacks the ₹ glyph, so use text-safe prefixes.
const CUR_PREFIX: Record<string, string> = { INR: 'Rs ', USD: '$', GBP: '£', AUD: 'A$' };
function pdfCurrency(amount: number, currency: string): string {
  const p = CUR_PREFIX[currency] ?? '';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${p}${Math.round(amount || 0).toLocaleString(locale)}`;
}

// ---- palette (matches the app) ----
const C = {
  primary: '#6366f1', violet: '#8b5cf6', sky: '#0ea5e9',
  success: '#10b981', danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6',
  text: '#0f172a', muted: '#64748b', border: '#e2e8f0', card: '#f8fafc', white: '#ffffff',
};

const PAGE_W = 595.28, PAGE_H = 841.89, M = 40;
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - M - 16;

type Doc = InstanceType<typeof PDFDocument>;

/** Build the full business-snapshot PDF for a tenant. Returns a Buffer. */
export async function generateReportPdf(ownerId: string, requestedBy: string): Promise<{ buffer: Buffer; fileName: string }> {
  const now = new Date();
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  const currency = owner?.currency || 'INR';
  const fmt = (n: number) => pdfCurrency(n, currency);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const since30 = Date.now() - 30 * 86400000;

  const [openInvoices, openBills, chart, statement, budget, proj, recentTxns, last30Txns] = await Promise.all([
    prisma.invoice.findMany({ where: { ownerId, state: { in: ['SENT', 'OVERDUE'] } }, include: { customer: true }, orderBy: { dueDate: 'asc' } }),
    prisma.bill.findMany({ where: { ownerId, state: { in: ['PENDING', 'OVERDUE'] } }, include: { vendor: true }, orderBy: { dueDate: 'asc' } }),
    dailyCashFlow(ownerId, 30),
    cashFlowStatement(ownerId, monthStart, monthEnd),
    budgetVsActuals(ownerId, now.getMonth() + 1, now.getFullYear()),
    forecast(ownerId, 90),
    prisma.transaction.findMany({ where: { ownerId }, orderBy: { date: 'desc' }, take: 10 }),
    prisma.transaction.findMany({ where: { ownerId, date: { gte: new Date(since30) } } }),
  ]);

  const receivables = openInvoices.reduce((s, i) => s + i.totalAmount, 0);
  const payables = openBills.reduce((s, b) => s + b.totalAmount, 0);
  const moneyIn = chart.reduce((s, d) => s + d.Inflows, 0);
  const moneyOut = chart.reduce((s, d) => s + d.Outflows, 0);
  const netChange = moneyIn - moneyOut;

  const overdueInvoices = openInvoices.filter((i) => daysOverdue(i.dueDate) > 0);
  const overdueBills = openBills.filter((b) => daysOverdue(b.dueDate) > 0);

  // expense breakdown (last 30 days OUT by category)
  const expMap = new Map<string, number>();
  for (const t of last30Txns) if (t.type === 'OUT') expMap.set(t.category || 'Other', (expMap.get(t.category || 'Other') || 0) + t.amount);
  const expenses = [...expMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // AR aging
  const aging = [
    { name: 'Current', value: 0, color: C.success },
    { name: '1–30d', value: 0, color: C.warning },
    { name: '31–60d', value: 0, color: '#f97316' },
    { name: '60d+', value: 0, color: C.danger },
  ];
  for (const inv of openInvoices) {
    const d = daysOverdue(inv.dueDate);
    aging[d === 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3].value += inv.totalAmount;
  }

  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true, info: { Title: `${owner?.businessName || 'Business'} Report`, Author: 'CashFlow Pro' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const state = { y: M };

  // ---------- drawing helpers ----------
  const ensure = (need: number) => { if (state.y + need > BOTTOM) { doc.addPage(); state.y = M; } };
  const sectionTitle = (title: string) => {
    ensure(40);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.text).text(title, M, state.y);
    state.y += 18;
    doc.moveTo(M, state.y).lineTo(M + CONTENT_W, state.y).lineWidth(1).strokeColor(C.border).stroke();
    state.y += 12;
  };

  // ---------- header band ----------
  doc.rect(0, 0, PAGE_W, 92).fill(C.primary);
  doc.roundedRect(M, 26, 30, 30, 7).fill(C.white);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(C.primary).text('CF', M, 35, { width: 30, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.white).text(owner?.businessName || 'Your Business', M + 42, 28);
  doc.font('Helvetica').fontSize(10).fillColor('#e0e7ff').text('Business Snapshot Report — CashFlow Pro', M + 42, 52);
  doc.fontSize(9).fillColor('#e0e7ff').text(
    `Generated ${now.toLocaleDateString()} ${now.toLocaleTimeString()}  ·  Prepared by ${requestedBy}  ·  Currency ${currency}`,
    M + 42, 66);
  state.y = 110;

  // ---------- KPI cards ----------
  const kpis = [
    { label: 'Bank Balance', value: fmt(owner?.bankBalance || 0), color: C.primary },
    { label: '30-Day Net Change', value: (netChange >= 0 ? '+' : '-') + fmt(Math.abs(netChange)), color: netChange >= 0 ? C.success : C.danger },
    { label: 'Money In (30d)', value: fmt(moneyIn), color: C.success },
    { label: 'Money Out (30d)', value: fmt(moneyOut), color: C.danger },
    { label: 'Receivables Due', value: fmt(receivables), color: C.info },
    { label: 'Payables Due', value: fmt(payables), color: C.warning },
  ];
  const cols = 3, gap = 12;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols, cardH = 56;
  kpis.forEach((k, i) => {
    const cx = M + (i % cols) * (cardW + gap);
    const cy = state.y + Math.floor(i / cols) * (cardH + gap);
    doc.roundedRect(cx, cy, cardW, cardH, 8).fillAndStroke(C.card, C.border);
    doc.rect(cx, cy + 6, 3, cardH - 12).fill(k.color);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(k.label.toUpperCase(), cx + 12, cy + 10, { width: cardW - 20 });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(C.text).text(k.value, cx + 12, cy + 26, { width: cardW - 20 });
  });
  state.y += 2 * cardH + gap + 18;

  // ---------- 30-day cash-flow line chart ----------
  sectionTitle('30-Day Cash Flow');
  drawLineChart(doc, M, state.y, CONTENT_W, 170, chart, fmt);
  state.y += 170 + 20;

  // ---------- expense breakdown + AR aging (side by side) ----------
  ensure(200);
  const halfW = (CONTENT_W - 20) / 2;
  const panelTop = state.y;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text).text('Where the Money Goes (30d)', M, panelTop);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.text).text('Receivables Aging', M + halfW + 20, panelTop);
  const barsTop = panelTop + 20;
  drawHBars(doc, M, barsTop, halfW, expenses.map((e) => ({ label: e.name, value: e.value, color: C.primary })), fmt);
  drawHBars(doc, M + halfW + 20, barsTop, halfW, aging.filter((a) => a.value > 0).map((a) => ({ label: a.name, value: a.value, color: a.color })), fmt);
  const bh = Math.max(expenses.length, aging.filter((a) => a.value > 0).length || 1) * 26 + 10;
  state.y = barsTop + bh + 18;

  // ---------- statement of cash flows ----------
  sectionTitle('Statement of Cash Flows (This Month)');
  const opN = statement.operating.in - statement.operating.out;
  const inN = statement.investing.in - statement.investing.out;
  const fiN = statement.financing.in - statement.financing.out;
  const stmtRows = [
    ['Opening Cash Balance', fmt(statement.opening), C.text, true],
    ['Operating — inflows', '+' + fmt(statement.operating.in), C.success, false],
    ['Operating — outflows', '-' + fmt(statement.operating.out), C.danger, false],
    ['Net Operating', (opN >= 0 ? '+' : '-') + fmt(Math.abs(opN)), C.text, true],
    ['Net Investing', (inN >= 0 ? '+' : '-') + fmt(Math.abs(inN)), C.text, true],
    ['Net Financing', (fiN >= 0 ? '+' : '-') + fmt(Math.abs(fiN)), C.text, true],
    ['Closing Cash Balance', fmt(statement.closing), C.primary, true],
  ];
  drawKeyValueTable(doc, M, state.y, CONTENT_W, stmtRows, () => { ensure(24); return state.y; }, (dy) => { state.y = dy; });
  state.y += 8;

  // ---------- budget vs actuals ----------
  if (budget.length) {
    sectionTitle('Budget vs Actuals (This Month)');
    for (const row of budget) {
      ensure(30);
      const pct = row.budget > 0 ? Math.min(1, row.actual / row.budget) : 1;
      const over = row.actual > row.budget;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(C.text).text(row.category, M, state.y);
      doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`${fmt(row.actual)} of ${fmt(row.budget)}`, M, state.y, { width: CONTENT_W, align: 'right' });
      const trackY = state.y + 13;
      doc.roundedRect(M, trackY, CONTENT_W, 7, 3.5).fill('#eef2ff');
      doc.roundedRect(M, trackY, Math.max(3, CONTENT_W * pct), 7, 3.5).fill(over ? C.danger : pct >= 0.8 ? C.warning : C.success);
      state.y = trackY + 16;
    }
    state.y += 6;
  }

  // ---------- forecast ----------
  sectionTitle('90-Day Risk-Adjusted Forecast');
  const last = proj.series[proj.series.length - 1] || { confirmed: 0, bestCase: 0, worstCase: 0 };
  const fc = [
    { label: 'Confirmed path', value: fmt(last.confirmed), color: C.primary },
    { label: 'Best case', value: fmt(last.bestCase), color: C.success },
    { label: 'Worst case', value: fmt(last.worstCase), color: C.danger },
  ];
  fc.forEach((f, i) => {
    const cw = (CONTENT_W - 24) / 3, cx = M + i * (cw + 12);
    doc.roundedRect(cx, state.y, cw, 46, 8).fillAndStroke(C.card, C.border);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(f.label.toUpperCase() + ' — DAY 90', cx + 10, state.y + 9, { width: cw - 16 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(f.color).text(f.value, cx + 10, state.y + 24, { width: cw - 16 });
  });
  state.y += 46 + 12;
  for (const raw of proj.insights.slice(0, 3)) {
    const ins = raw.replace(/₹\s*/g, 'Rs '); // Helvetica lacks the ₹ glyph
    ensure(28);
    doc.circle(M + 3, state.y + 5, 2).fill(C.warning);
    doc.font('Helvetica').fontSize(9).fillColor(C.text).text(ins, M + 12, state.y, { width: CONTENT_W - 12 });
    state.y += Math.max(16, doc.heightOfString(ins, { width: CONTENT_W - 12 })) + 4;
  }
  state.y += 6;

  // ---------- action items ----------
  if (overdueInvoices.length || overdueBills.length) {
    sectionTitle('Action Center — Needs Attention');
    if (overdueInvoices.length) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text).text('Overdue invoices to collect', M, state.y); state.y += 15;
      for (const inv of overdueInvoices.slice(0, 8)) {
        ensure(16);
        doc.font('Helvetica').fontSize(9).fillColor(C.text).text(`${inv.customer.name} — ${inv.invoiceNumber} (${daysOverdue(inv.dueDate)}d overdue)`, M + 8, state.y);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.danger).text(fmt(inv.totalAmount), M, state.y, { width: CONTENT_W, align: 'right' });
        state.y += 14;
      }
      state.y += 6;
    }
    if (overdueBills.length) {
      ensure(20);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.text).text('Overdue bills to pay', M, state.y); state.y += 15;
      for (const b of overdueBills.slice(0, 8)) {
        ensure(16);
        doc.font('Helvetica').fontSize(9).fillColor(C.text).text(`${b.vendor.name} — ${b.billNumber} (${b.category}, ${daysOverdue(b.dueDate)}d overdue)`, M + 8, state.y);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(C.danger).text(fmt(b.totalAmount), M, state.y, { width: CONTENT_W, align: 'right' });
        state.y += 14;
      }
      state.y += 6;
    }
  }

  // ---------- recent transactions ----------
  sectionTitle('Recent Transactions');
  ensure(20);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted);
  doc.text('DATE', M, state.y); doc.text('DESCRIPTION', M + 70, state.y);
  doc.text('CATEGORY', M + 320, state.y); doc.text('AMOUNT', M, state.y, { width: CONTENT_W, align: 'right' });
  state.y += 14;
  recentTxns.forEach((t, i) => {
    ensure(16);
    if (i % 2 === 0) doc.rect(M, state.y - 3, CONTENT_W, 16).fill(C.card);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.muted).text(new Date(t.date).toLocaleDateString(), M, state.y);
    doc.fillColor(C.text).text(t.description.slice(0, 46), M + 70, state.y, { width: 245 });
    doc.fillColor(C.muted).text(t.category || t.tag, M + 320, state.y, { width: 120 });
    doc.font('Helvetica-Bold').fillColor(t.type === 'IN' ? C.success : C.danger)
      .text((t.type === 'IN' ? '+' : '-') + fmt(t.amount), M, state.y, { width: CONTENT_W, align: 'right' });
    state.y += 16;
  });

  // ---------- footers (page numbers) ----------
  const range = doc.bufferedPageRange();
  const footY = PAGE_H - M - 12; // keep inside the printable area so no overflow page is spawned
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(
      `CashFlow Pro  ·  ${owner?.businessName || ''}  ·  ${now.toLocaleString()}`,
      M, footY, { width: CONTENT_W, align: 'left', lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, M, footY, { width: CONTENT_W, align: 'right', lineBreak: false });
  }

  doc.end();
  const buffer = await done;

  const slug = (owner?.businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
  const d = now;
  const pad = (n: number) => String(n).padStart(2, '0');
  const fileName = `${slug}_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.pdf`;
  return { buffer, fileName };
}

// ---------- chart primitives ----------

function drawLineChart(doc: Doc, x: number, y: number, w: number, h: number, data: { name: string; Inflows: number; Outflows: number }[], fmt: (n: number) => string) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke('#ffffff', C.border);
  const padL = 70, padR = 16, padT = 28, padB = 22;
  const plotX = x + padL, plotY = y + padT, plotW = w - padL - padR, plotH = h - padT - padB;
  const max = Math.max(1, ...data.map((d) => Math.max(d.Inflows, d.Outflows)));

  // gridlines + y labels
  doc.font('Helvetica').fontSize(7).fillColor(C.muted);
  for (let g = 0; g <= 4; g++) {
    const gy = plotY + plotH - (plotH * g) / 4;
    doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).lineWidth(0.5).strokeColor('#f1f5f9').stroke();
    doc.fillColor(C.muted).text(fmt((max * g) / 4), x + 6, gy - 4, { width: padL - 12, align: 'right' });
  }
  const px = (i: number) => plotX + (plotW * i) / Math.max(1, data.length - 1);
  const py = (v: number) => plotY + plotH - (plotH * v) / max;
  const line = (key: 'Inflows' | 'Outflows', color: string) => {
    doc.strokeColor(color).lineWidth(1.8);
    data.forEach((d, i) => { const X = px(i), Y = py(d[key]); i === 0 ? doc.moveTo(X, Y) : doc.lineTo(X, Y); });
    doc.stroke();
  };
  line('Inflows', C.success);
  line('Outflows', C.danger);
  // x labels (every ~5th)
  doc.font('Helvetica').fontSize(6.5).fillColor(C.muted);
  data.forEach((d, i) => { if (i % 5 === 0) doc.text(d.name, px(i) - 10, plotY + plotH + 6, { width: 20, align: 'center' }); });
  // legend
  doc.circle(x + padL, y + 14, 3).fill(C.success); doc.font('Helvetica').fontSize(8).fillColor(C.muted).text('Inflows', x + padL + 8, y + 10);
  doc.circle(x + padL + 70, y + 14, 3).fill(C.danger); doc.fillColor(C.muted).text('Outflows', x + padL + 78, y + 10);
}

function drawHBars(doc: Doc, x: number, y: number, w: number, items: { label: string; value: number; color: string }[], fmt: (n: number) => string) {
  if (!items.length) { doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No data.', x, y); return; }
  const max = Math.max(1, ...items.map((i) => i.value));
  const labelW = 92, rowH = 26, barMax = w - labelW - 4;
  items.forEach((it, i) => {
    const ry = y + i * rowH;
    doc.font('Helvetica').fontSize(8).fillColor(C.text).text(it.label, x, ry + 1, { width: labelW - 6, ellipsis: true });
    doc.roundedRect(x + labelW, ry, barMax, 12, 3).fill('#eef2ff');
    doc.roundedRect(x + labelW, ry, Math.max(3, barMax * (it.value / max)), 12, 3).fill(it.color);
    doc.font('Helvetica').fontSize(7.5).fillColor(C.muted).text(fmt(it.value), x + labelW, ry + 14, { width: barMax });
  });
}

function drawKeyValueTable(doc: Doc, x: number, y: number, w: number, rows: any[][], ensure: () => number, setY: (n: number) => void) {
  let cy = y;
  rows.forEach((r, i) => {
    cy = ensure();
    const [label, value, color, bold] = r;
    if (bold) doc.rect(x, cy - 2, w, 18).fill('#f8fafc');
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(bold ? C.text : C.muted).text(label, x + 8, cy + 1);
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(color).text(value, x, cy + 1, { width: w - 8, align: 'right' });
    cy += 18;
    setY(cy);
  });
}
