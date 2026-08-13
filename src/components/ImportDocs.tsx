'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, FileText, Trash, Plus, Sparkles, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { lineItemsTotal, EXPENSE_CATEGORIES, type LineItem } from '@/lib/constants';
import './ImportDocs.css';

type Draft = {
  fileName: string;
  method: 'text' | 'ocr';
  docType: 'INVOICE' | 'BILL';
  partyName: string;
  number: string;
  issueDate: string;
  dueDate: string;
  category: string;
  currency: string;
  items: LineItem[];
  total: number;
  confidence: Record<string, string>;
  warnings: string[];
};

type Stage = 'select' | 'extracting' | 'review' | 'committing';

const dot = (level?: string) =>
  level === 'low' ? 'conf-dot conf-low' : level === 'medium' ? 'conf-dot conf-med' : 'conf-dot conf-high';

export function ImportDocsButton({ currency = 'INR' }: { currency?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('select');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [errors, setErrors] = useState<{ fileName: string; error: string }[]>([]);
  const [serverError, setServerError] = useState('');

  const fmt = (n: number) => formatCurrency(n, currency);

  const reset = () => { setStage('select'); setDrafts([]); setErrors([]); setServerError(''); };
  const close = () => { setOpen(false); reset(); };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 10) { setServerError('Please upload at most 10 PDFs at once.'); return; }
    setServerError('');
    setStage('extracting');
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    try {
      const res = await fetch('/api/import/extract', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      setErrors(data.errors || []);
      if (!data.drafts?.length) { setServerError('Could not read any details from those files.'); setStage('select'); return; }
      setDrafts(data.drafts);
      setStage('review');
    } catch (e: any) {
      setServerError(e.message);
      setStage('select');
    }
  };

  const patch = (i: number, p: Partial<Draft>) => setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...p } : d)));
  const patchItem = (di: number, ii: number, p: Partial<LineItem>) =>
    setDrafts((ds) => ds.map((d, idx) => idx === di ? { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, ...p } : it)) } : d));
  const addItem = (di: number) => setDrafts((ds) => ds.map((d, idx) => idx === di ? { ...d, items: [...d.items, { desc: '', qty: 1, unitPrice: 0, taxRate: 0 }] } : d));
  const removeItem = (di: number, ii: number) => setDrafts((ds) => ds.map((d, idx) => idx === di ? { ...d, items: d.items.filter((_, j) => j !== ii) } : d));
  const removeDraft = (di: number) => setDrafts((ds) => ds.filter((_, idx) => idx !== di));

  const commit = async () => {
    setStage('committing');
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      const msg = `Imported ${data.invoices} invoice(s) and ${data.bills} bill(s).` + (data.failures?.length ? `\n${data.failures.length} skipped.` : '');
      alert(msg);
      close();
      router.refresh();
    } catch (e: any) {
      setServerError(e.message);
      setStage('review');
    }
  };

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}><UploadCloud size={16} /> Upload PDF</button>

      {open && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-content modal-wide import-modal animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-1">
              <h2 className="text-h2 flex-center" style={{ gap: 8, justifyContent: 'flex-start' }}><Sparkles size={20} /> Import Invoices & Bills</h2>
              <button className="action-btn" onClick={close}><X size={18} /></button>
            </div>
            <p className="text-muted text-sm mb-4">Upload PDFs and we&apos;ll read the details for you. Review and edit before importing — nothing is saved until you confirm.</p>

            {serverError && <div className="alert-error mb-4">{serverError}</div>}

            {/* SELECT */}
            {stage === 'select' && (
              <div className="dropzone" onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
                <UploadCloud size={40} />
                <p className="font-semibold mt-2">Drop PDFs here or click to browse</p>
                <p className="text-muted text-sm">Up to 10 files · PDF only · max 10 MB each</p>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              </div>
            )}

            {/* EXTRACTING */}
            {stage === 'extracting' && (
              <div className="import-loading">
                <div className="spinner" />
                <p className="font-semibold mt-3">Reading your documents…</p>
                <p className="text-muted text-sm">Extracting text and detecting fields.</p>
              </div>
            )}

            {/* REVIEW */}
            {(stage === 'review' || stage === 'committing') && (
              <>
                {errors.length > 0 && (
                  <div className="alert-error mb-4">
                    {errors.length} file(s) couldn&apos;t be read: {errors.map((e) => e.fileName).join(', ')}
                  </div>
                )}
                <div className="draft-list">
                  {drafts.map((d, i) => {
                    const total = Math.round(lineItemsTotal(d.items));
                    return (
                      <div key={i} className="draft-card glass-card">
                        <div className="flex-between mb-3">
                          <span className="flex-center text-sm font-semibold" style={{ gap: 6, justifyContent: 'flex-start' }}>
                            <FileText size={15} /> {d.fileName}
                            <span className={`method-badge ${d.method}`}>{d.method === 'ocr' ? 'OCR' : 'text'}</span>
                          </span>
                          <button className="action-btn text-danger" title="Discard" onClick={() => removeDraft(i)}><Trash size={15} /></button>
                        </div>

                        {d.warnings.length > 0 && (
                          <div className="draft-warn"><AlertTriangle size={13} /> {d.warnings.join(' · ')}</div>
                        )}

                        <div className="draft-grid">
                          <label className="dz-field">
                            <span>Type</span>
                            <select className="input-field" value={d.docType} onChange={(e) => patch(i, { docType: e.target.value as any })}>
                              <option value="BILL">Bill (we pay)</option>
                              <option value="INVOICE">Invoice (we collect)</option>
                            </select>
                          </label>
                          <label className="dz-field">
                            <span>{d.docType === 'BILL' ? 'Vendor' : 'Customer'} <i className={dot(d.confidence.partyName)} /></span>
                            <input className="input-field" value={d.partyName} onChange={(e) => patch(i, { partyName: e.target.value })} />
                          </label>
                          <label className="dz-field">
                            <span>Number <i className={dot(d.confidence.number)} /></span>
                            <input className="input-field" value={d.number} onChange={(e) => patch(i, { number: e.target.value })} />
                          </label>
                          <label className="dz-field">
                            <span>Issue date <i className={dot(d.confidence.issueDate)} /></span>
                            <input type="date" className="input-field" value={d.issueDate} onChange={(e) => patch(i, { issueDate: e.target.value })} />
                          </label>
                          <label className="dz-field">
                            <span>Due date <i className={dot(d.confidence.dueDate)} /></span>
                            <input type="date" className="input-field" value={d.dueDate} onChange={(e) => patch(i, { dueDate: e.target.value })} />
                          </label>
                          {d.docType === 'BILL' && (
                            <label className="dz-field">
                              <span>Category <i className={dot(d.confidence.category)} /></span>
                              <select className="input-field" value={d.category || 'Other'} onChange={(e) => patch(i, { category: e.target.value })}>
                                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </label>
                          )}
                        </div>

                        <div className="draft-items">
                          <div className="di-head"><span>Description</span><span>Qty</span><span>Rate</span><span>Tax%</span><span /></div>
                          {d.items.map((it, j) => (
                            <div key={j} className="di-row">
                              <input className="input-field" value={it.desc} placeholder="Item" onChange={(e) => patchItem(i, j, { desc: e.target.value })} />
                              <input type="number" className="input-field" value={it.qty} onChange={(e) => patchItem(i, j, { qty: +e.target.value })} />
                              <input type="number" className="input-field" value={it.unitPrice} onChange={(e) => patchItem(i, j, { unitPrice: +e.target.value })} />
                              <input type="number" className="input-field" value={it.taxRate} onChange={(e) => patchItem(i, j, { taxRate: +e.target.value })} />
                              <button className="action-btn text-danger" onClick={() => removeItem(i, j)}><X size={14} /></button>
                            </div>
                          ))}
                          <button className="link-btn" onClick={() => addItem(i)}><Plus size={13} /> Add line</button>
                        </div>

                        <div className="flex-between draft-total">
                          <span className="text-muted text-sm">Total</span>
                          <span className="text-h2">{fmt(total)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-between mt-4 gap-2">
                  <button className="btn-secondary" onClick={() => reset()}>Start over</button>
                  <button className="btn-primary" onClick={commit} disabled={stage === 'committing' || drafts.length === 0}>
                    {stage === 'committing' ? 'Importing…' : `Confirm & Import ${drafts.length} document${drafts.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
