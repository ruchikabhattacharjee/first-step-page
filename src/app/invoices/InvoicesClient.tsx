'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Invoices.css';
import { HelpTooltip } from '@/components/Tooltip';
import { Plus, Edit, Trash, CheckCircle, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { agingClass, lineItemsTotal, type LineItem } from '@/lib/constants';
import { ImportDocsButton } from '@/components/ImportDocs';

const blankItem = (): LineItem => ({ desc: '', qty: 1, unitPrice: 0, taxRate: 0 });
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoicesClient({ initialInvoices, customers, kpis, currency, canWrite }: any) {
  const router = useRouter();
  const fmt = (n: number) => formatCurrency(n, currency);

  const [editing, setEditing] = useState<any | null>(null); // invoice being edited, or {} for new
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ---- form state ----
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState(today());
  const [items, setItems] = useState<LineItem[]>([blankItem()]);

  const openNew = () => {
    setEditing({}); setError('');
    setCustomerName(''); setDueDate(today()); setItems([blankItem()]);
  };
  const openEdit = (inv: any) => {
    setEditing(inv); setError('');
    setCustomerName(inv.customer?.name || '');
    setDueDate(new Date(inv.dueDate).toISOString().slice(0, 10));
    setItems(JSON.parse(inv.items));
  };

  const setItem = (i: number, patch: Partial<LineItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const save = async (state: 'DRAFT' | 'SENT', e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const isEdit = editing && editing.id;
    try {
      const res = await fetch(isEdit ? `/api/invoices/${editing.id}` : '/api/invoices', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, dueDate, items, state }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setEditing(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (inv: any) => {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    const res = await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert((await res.json()).error || 'Failed to delete');
  };

  const markPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.target as HTMLFormElement);
    const res = await fetch(`/api/invoices/${payTarget.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paidDate: form.get('paidDate'), method: form.get('method'), amount: form.get('amount') }),
    });
    setBusy(false);
    if (res.ok) { setPayTarget(null); router.refresh(); window.dispatchEvent(new Event('cashflow:refresh')); }
    else alert((await res.json()).error || 'Failed');
  };

  const formTotal = lineItemsTotal(items);

  return (
    <div className="invoices-container animate-fade-in">
      <div className="kpi-banner glass-card mb-6">
        <div className="kpi-item">
          <span className="text-muted text-xs uppercase">Total Receivables</span>
          <span className="text-h2 mt-2">{fmt(kpis.totalReceivables)}</span>
        </div>
        <div className="kpi-item">
          <span className="text-muted text-xs uppercase">Overdue Balance</span>
          <span className="text-h2 mt-2 text-danger">{fmt(kpis.overdueAggregate)}</span>
        </div>
        <div className="kpi-item">
          <span className="text-muted text-xs uppercase">Collected This Month</span>
          <span className="text-h2 mt-2 text-success">{fmt(kpis.collectedThisMonth)}</span>
        </div>
        <div className="kpi-item">
          <span className="text-muted text-xs uppercase flex-center" style={{ justifyContent: 'flex-start', gap: 4 }}>
            Avg Days to Pay (DSO) <HelpTooltip content="Average number of days to collect payment after an invoice is issued." />
          </span>
          <span className="text-h2 mt-2">{kpis.dso} Days</span>
        </div>
      </div>

      <div className="invoices-list-wrapper glass-panel">
        <div className="flex-between mb-4">
          <h2 className="text-h2">Invoices (AR)</h2>
          {canWrite && (
            <div className="flex-between gap-2">
              <ImportDocsButton currency={currency} />
              <button className="btn-primary" onClick={openNew}><Plus size={16} /> Create Invoice</button>
            </div>
          )}
        </div>

        {initialInvoices.length === 0 ? (
          <div className="empty-state text-center py-6">
            <h3 className="mb-2 font-semibold">No Invoices Yet</h3>
            <p className="text-muted mb-4">Create your first invoice to start tracking receivables.</p>
            {canWrite && <button className="btn-secondary" onClick={openNew}>+ Create Invoice</button>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Invoice #</th><th>Customer</th><th>Due Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {initialInvoices.map((inv: any) => (
                <tr key={inv.id}>
                  <td className="font-semibold">{inv.invoiceNumber}</td>
                  <td>{inv.customer.name}</td>
                  <td>{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className="font-bold">{fmt(inv.totalAmount)}</td>
                  <td><span className={`status-pill ${agingClass(inv.dueDate, inv.state)}`}>{inv.state}</span></td>
                  <td className="actions-cell">
                    {canWrite && inv.state !== 'PAID' && (
                      <button className="action-btn text-success" title="Mark as Paid" onClick={() => setPayTarget(inv)}><CheckCircle size={16} /></button>
                    )}
                    {canWrite && inv.state !== 'PAID' && (
                      <button className="action-btn" title="Edit" onClick={() => openEdit(inv)}><Edit size={16} /></button>
                    )}
                    {canWrite && (
                      <button className="action-btn text-danger" title="Delete" onClick={() => del(inv)}><Trash size={16} /></button>
                    )}
                    {!canWrite && <span className="text-xs text-muted">View only</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {editing && (
        <div className="modal-overlay flex-center" onClick={() => setEditing(null)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h2 className="text-h2">{editing.id ? `Edit ${editing.invoiceNumber}` : 'Create New Invoice'}</h2>
              <button className="action-btn" onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            {error && <div className="alert-error mb-4">{error}</div>}
            <form onSubmit={(e) => save('SENT', e)}>
              <div className="flex-between gap-4">
                <div className="form-group flex-1">
                  <label>Customer Name</label>
                  <input className="input-field" list="customer-list" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                  <datalist id="customer-list">{customers.map((c: any) => <option key={c.id} value={c.name} />)}</datalist>
                </div>
                <div className="form-group flex-1">
                  <label>Due Date</label>
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

              <div className="flex-between mt-4 mb-2">
                <span className="text-muted">Total (incl. tax)</span>
                <span className="text-h2">{fmt(formTotal)}</span>
              </div>
              <div className="flex-between mt-4 gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <div className="flex-between gap-2">
                  <button type="button" className="btn-secondary" disabled={busy} onClick={(e) => save('DRAFT', e as any)}>Save as Draft</button>
                  <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save & Send'}</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark as Paid modal */}
      {payTarget && (
        <div className="modal-overlay flex-center" onClick={() => setPayTarget(null)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h2 mb-4">Log Payment — {payTarget.invoiceNumber}</h2>
            <form onSubmit={markPaid}>
              <div className="form-group"><label>Payment Date</label><input name="paidDate" type="date" className="input-field" defaultValue={today()} required /></div>
              <div className="form-group"><label>Collection Method</label>
                <select name="method" className="input-field" defaultValue="Bank Transfer">
                  {['Bank Transfer', 'UPI', 'Cash', 'Card', 'Cheque'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Amount Received</label><input name="amount" type="number" className="input-field" defaultValue={payTarget.totalAmount} required /></div>
              <div className="flex-between mt-4 gap-2">
                <button type="button" className="btn-secondary" onClick={() => setPayTarget(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Recording…' : 'Confirm Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
