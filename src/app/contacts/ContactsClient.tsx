'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Contacts.css';
import { User, Building, Users, Plus, Edit, Trash, X } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export default function ContactsClient({ initialContacts, currency, canWrite }: any) {
  const router = useRouter();
  const fmt = (n: number) => formatCurrency(n, currency);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [type, setTypeVal] = useState('CUSTOMER');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const openNew = () => { setEditing({}); setError(''); setName(''); setTypeVal('CUSTOMER'); setEmail(''); setPhone(''); };
  const openEdit = (c: any) => { setEditing(c); setError(''); setName(c.name); setTypeVal(c.type); setEmail(c.email || ''); setPhone(c.phone || ''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    const isEdit = editing && editing.id;
    try {
      const res = await fetch(isEdit ? `/api/contacts/${editing.id}` : '/api/contacts', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, email, phone }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      setEditing(null); router.refresh();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const del = async (c: any) => {
    if (!confirm(`Delete contact ${c.name}?`)) return;
    const res = await fetch(`/api/contacts/${c.id}`, { method: 'DELETE' });
    if (res.ok) router.refresh(); else alert((await res.json()).error || 'Failed');
  };

  const getTypeIcon = (t: string) => t === 'CUSTOMER' ? <User size={16} className="text-info" /> : t === 'VENDOR' ? <Building size={16} className="text-orange" /> : <Users size={16} className="text-primary" />;

  return (
    <div className="contacts-container animate-fade-in">
      <div className="flex-between mb-6">
        <h2 className="text-h2">Unified Contacts Directory</h2>
        {canWrite && <button className="btn-primary" onClick={openNew}><Plus size={16} /> Add Contact</button>}
      </div>

      <div className="contacts-list-wrapper glass-panel">
        {initialContacts.length === 0 ? (
          <div className="empty-state text-center py-6">
            <h3 className="mb-2 font-semibold">No Contacts Yet</h3>
            <p className="text-muted mb-4">Add customers and vendors to track invoices and bills against them.</p>
            {canWrite && <button className="btn-secondary" onClick={openNew}>+ Add Contact</button>}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Type</th><th>Business / Name</th><th>Email</th><th>Invoiced</th><th>Billed</th><th>Net Balance</th>{canWrite && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {initialContacts.map((contact: any) => (
                <React.Fragment key={contact.id}>
                  <tr className="contact-row" onClick={() => setExpandedRow(expandedRow === contact.id ? null : contact.id)}>
                    <td><div className="flex-between" style={{ justifyContent: 'flex-start', gap: 8 }}>{getTypeIcon(contact.type)}<span className="font-semibold">{contact.type}</span></div></td>
                    <td className="font-bold">{contact.name}</td>
                    <td className="text-muted">{contact.email || '-'}</td>
                    <td>{contact.totalInvoiced > 0 ? fmt(contact.totalInvoiced) : '-'}</td>
                    <td>{contact.totalBilled > 0 ? fmt(contact.totalBilled) : '-'}</td>
                    <td><span className={`font-bold ${contact.activeNetBalance > 0 ? 'text-success' : contact.activeNetBalance < 0 ? 'text-danger' : ''}`}>{contact.activeNetBalance > 0 ? '+' : ''}{fmt(contact.activeNetBalance)}</span></td>
                    {canWrite && (
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <button className="action-btn" title="Edit" onClick={() => openEdit(contact)}><Edit size={16} /></button>
                        <button className="action-btn text-danger" title="Delete" onClick={() => del(contact)}><Trash size={16} /></button>
                      </td>
                    )}
                  </tr>
                  {expandedRow === contact.id && (
                    <tr className="history-row animate-fade-in">
                      <td colSpan={canWrite ? 7 : 6} className="p-0">
                        <div className="history-container">
                          <h4 className="font-semibold mb-3 text-sm uppercase text-muted">Transaction History</h4>
                          {contact.history.length === 0 ? (
                            <p className="text-muted text-sm">No recorded history.</p>
                          ) : (
                            <ul className="history-feed">
                              {contact.history.map((item: any) => (
                                <li key={item.id} className="history-item">
                                  <div className="history-dot" />
                                  <div className="history-content flex-between">
                                    <div><span className="font-semibold block">{item.type}</span><span className="text-xs text-muted">{new Date(item.date).toLocaleDateString()}</span></div>
                                    <span className={`font-bold ${item.amount > 0 ? 'text-success' : 'text-danger'}`}>{item.amount > 0 ? '+' : '-'}{fmt(Math.abs(item.amount))}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="modal-overlay flex-center" onClick={() => setEditing(null)}>
          <div className="modal-content glass-panel animate-fade-in" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4"><h2 className="text-h2">{editing.id ? 'Edit Contact' : 'Add Contact'}</h2><button className="action-btn" onClick={() => setEditing(null)}><X size={18} /></button></div>
            {error && <div className="alert-error mb-4">{error}</div>}
            <form onSubmit={save}>
              <div className="form-group"><label>Business / Individual Name</label><input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div className="form-group"><label>Designation</label>
                <select className="input-field" value={type} onChange={(e) => setTypeVal(e.target.value)}>
                  <option value="CUSTOMER">Customer</option><option value="VENDOR">Vendor</option><option value="BOTH">Both</option>
                </select>
              </div>
              <div className="form-group"><label>Email</label><input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="form-group"><label>Phone</label><input className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="flex-between mt-4 gap-2"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Contact'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
