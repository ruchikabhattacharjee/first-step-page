'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Bills.css';
import { HelpTooltip } from '@/components/Tooltip';
import { Plus, Edit, Trash, CheckCircle, X, Zap } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { agingClass, lineItemsTotal, EXPENSE_CATEGORIES, type LineItem } from '@/lib/constants';
import { ImportDocsButton } from '@/components/ImportDocs';

const blankItem = (): LineItem => ({ desc: '', qty: 1, unitPrice: 0, taxRate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function BillsClient({ initialBills, vendors, kpis, currency, canWrite }: any) {
  const router = useRouter();
  const fmt = (n: number) => formatCurrency(n, currency);

  const [editing, setEditing] = useState<any | null>(null);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [vendorName, setVendorName] = useState('');
  const [category, setCategory] = useState('Raw Materials');
  const [dueDate, setDueDate] = useState(today());
  const [items, setItems] = useState<LineItem[]>([blankItem()]);

  const openNew = () => { setEditing({}); setError(''); setVendorName(''); setCategory('Raw Materials'); setDueDate(today()); setItems([blankItem()]); };
  const openEdit = (b: any) => { setEditing(b); setError(''); setVendorName(b.vendor?.name || ''); setCategory(b.category); setDueDate(new Date(b.dueDate).toISOString().slice(0, 10)); setItems(JSON.parse(b.items)); };
  const setItem = (i: number, patch: Partial<LineItem>) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const save = async (state: 'DRAFT' | 'PENDING', e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const isEdit = editing && editing.id;
    try {
      const res = await fetch(isEdit ? `/api/bills/${editing.id}` : '/api/bills', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorName, category, dueDate, items, state }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setEditing(null); router.refresh();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const del = async (b: any) => {
    if (!confirm(`Delete bill ${b.billNumber}?`)) return;
    const res = await fetch(`/api/bills/${b.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh(); else alert((await res.json()).error || 'Failed');
  };

  const markPaid = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const form = new FormData(e.target as HTMLFormElement);
    const res = await fetch(`/api/bills/${payTarget.id}/pay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paidDate: form.get('paidDate'), method: form.get('method'), amount: form.get('amount') }),
    });
    setBusy(false);
    if (res.ok) { setPayTarget(null); router.refresh(); window.dispatchEvent(new Event('cashflow:refresh')); } else alert((await res.json()).error || 'Failed');
  };

  const logExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const form = new FormData(e.target as HTMLFormElement);
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: form.get('date'), category: form.get('category'), amount: form.get('amount'), description: form.get('description') }),
    });
    setBusy(false);
    if (res.ok) { setExpenseOpen(false); router.refresh(); window.dispatchEvent(new Event('cashflow:refresh')); } else alert((await res.json()).error || 'Failed');
  };

  return (
    <div className="bills-container animate-fade-in">
      <div className="kpi-banner glass-card mb-6">
        <div className="kpi-item"><span className="text-muted text-xs uppercase">Total Bills Due</span><span className="text-h2 mt-2">{fmt(kpis.totalBillsDue)}</span></div>
        <div className="kpi-item"><span className="text-muted text-xs uppercase">Overdue Payables</span><span className="text-h2 mt-2 text-danger">{fmt(kpis.overduePayables)}</span></div>
        <div className="kpi-item"><span className="text-muted text-xs uppercase">Paid This Month</span><span className="text-h2 mt-2 text-success">{fmt(kpis.paidThisMonth)}</span></div>
        <div className="kpi-item"><span className="text-muted text-xs uppercase flex-center" style={{ justifyContent: 'flex-start', gap: 4 }}>Largest Upcoming <HelpTooltip content="Your single biggest unpaid bill liability." /></span><span className="text-h2 mt-2">{fmt(kpis.largestUpcoming)}</span></div>
      </div>

      <div className="bills-list-wrapper glass-panel">
        <div className="flex-between mb-4">
          <h2 className="text-h2">Bills & Expenses (AP)</h2>
          {canWrite && (
            <div className="flex-between gap-2">
              <ImportDocsButton currency={currency} />
              <button className="btn-secondary" onClick={() => setExpenseOpen(true)}><Zap size={16} /> Quick Expense</button>
              <button className="btn-primary" onClick={openNew}><Plus size={16} /> Add Bill</button>
            </div>
          )}
        </div>

        {initialBills.length === 0 ? (
          <div className="empty-state text-center py-6">
            <h3 className="mb-2 font-semibold">No Bills Added</h3>
            <p className="text-muted mb-4">Track what you owe suppliers and when it's due.</p>
            {canWrite && <button className="btn-secondary" onClick={openNew}>+ Add Bill</button>}
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Bill #</th><th>Vendor</th><th>Category</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {initialBills.map((b: any) => (
                <tr key={b.id}>
                  <td className="font-semibold">{b.billNumber}</td>
                  <td>{b.vendor.name}</td>
                  <td>{b.category}</td>
                  <td>{new Date(b.dueDate).toLocaleDateString()}</td>
                  <td className="font-bold">{fmt(b.totalAmount)}</td>
                  <td><span className={`status-pill ${agingClass(b.dueDate, b.state)}`}>{b.state}</span></td>
                  <td className="actions-cell">
                    {canWrite && b.state !== 'PAID' && <button className="action-btn text-success" title="Mark as Paid" onClick={() => setPayTarget(b)}><CheckCircle size={16} /></button>}
                    {canWrite && b.state !== 'PAID' && <button className="action-btn" title="Edit" onClick={() => openEdit(b)}><Edit size={16} /></button>}
                    {canWrite && <button className="action-btn text-danger" title="Delete" onClick={() => del(b)}><Trash size={16} /></button>}
                    {!canWrite && <span className="text-xs text-muted">View only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Bill modal */}
      {editing && (
        <div className="modal-overlay flex-center" onClick={() => setEditing(null)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h2 className="text-h2">{editing.id ? `Edit ${editing.billNumber}` : 'Add New Bill'}</h2>
              <button className="action-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            {error && <div className="alert-error mb-4">{error}</div>}
            <form onSubmit={(e) => save('PENDING', e)}>
              <div className="flex-between gap-4">
                <div className="form-group flex-1"><label>Vendor Name</label>
                  <input className="input-field" list="vendor-list" value={vendorName} onChange={(e) => setVendorName(e.target.value)} required />
                  <datalist id="vendor-list">{vendors.map((v: any) => <option key={v.id} value={v.name} />)}</datalist>
                </div>
                <div className="form-group flex-1"><label>Category</label>
                  <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group flex-1"><label>Due Date</label>
                  <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                </div>
              </div>

              <label className="mt-2">Line Items</label>
              {items.map((it, i) => (
                <div key={i} className="line-item flex-between gap-2 mb-2">
                  <input className="input-field flex-1" placeholder="Description" value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} required />
                  <input type="number" className="input-field" style={{ width: 70 }} placeholder="Qty" value={it.qty} onChange={(e) => setItem(i, { qty: +e.target.value })} required />
                  <input type="number" className="input-field" style={{ width: 100 }} placeholder="Price" value={it.unitPrice} onChange={(e) => setItem(i, { unitPrice: +e.target.value })} required />
                  <input type="number" className="input-field" style={{ width: 70 }} placeholder="Tax%" value={it.taxRate} onChange={(e) => setItem(i, { taxRate: +e.target.value })} />
                  {items.length > 1 && <button type="button" className="action-btn text-danger" onClick={() => setItems(items.filter((_, idx) => idx !== i))}><X size={16} /></button>}
                </div>
              ))}
              <button type="button" className="text-primary text-sm font-semibold" onClick={() => setItems([...items, blankItem()])}>+ Add Line Item</button>

              <div className="flex-between mt-4 mb-2"><span className="text-muted">Total (incl. tax)</span><span className="text-h2">{fmt(lineItemsTotal(items))}</span></div>
              <div className="flex-between mt-4 gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <div className="flex-between gap-2">
                  <button type="button" className="btn-secondary" disabled={busy} onClick={(e) => save('DRAFT', e as any)}>Save as Draft</button>
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Bill'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Paid modal */}
      {payTarget && (
        <div className="modal-overlay flex-center" onClick={() => setPayTarget(null)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 mb-4">Pay Bill — {payTarget.billNumber}</h2>
            <form onSubmit={markPaid}>
              <div className="form-group"><label>Payment Date</label><input name="paidDate" type="date" className="input-field" defaultValue={today()} required /></div>
              <div className="form-group"><label>Payment Method</label><select name="method" className="input-field" defaultValue="Bank Transfer">{['Bank Transfer', 'UPI', 'Cash', 'Card', 'Cheque'].map((m) => <option key={m}>{m}</option>)}</select></div>
              <div className="form-group"><label>Amount Paid</label><input name="amount" type="number" className="input-field" defaultValue={payTarget.totalAmount} required /></div>
              <div className="flex-between mt-4 gap-2"><button type="button" className="btn-secondary" onClick={() => setPayTarget(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Recording…' : 'Confirm Payment'}</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Expense Logger */}
      {expenseOpen && (
        <div className="modal-overlay flex-center" onClick={() => setExpenseOpen(false)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 mb-1">Quick Expense</h2>
            <p className="text-muted text-sm mb-4">Records an out-of-pocket cost straight into the ledger.</p>
            <form onSubmit={logExpense}>
              <div className="form-group"><label>Date</label><input name="date" type="date" className="input-field" defaultValue={today()} required /></div>
              <div className="form-group"><label>Category</label><select name="category" className="input-field" defaultValue="Other">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label>Amount</label><input name="amount" type="number" className="input-field" placeholder="0" required /></div>
              <div className="form-group"><label>Description</label><input name="description" className="input-field" placeholder="e.g. Transit fuel" /></div>
              <div className="flex-between mt-4 gap-2"><button type="button" className="btn-secondary" onClick={() => setExpenseOpen(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Logging…' : 'Log Expense'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
