'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, Database, Bell, AlertOctagon, RefreshCw, Trash2 } from 'lucide-react';
import './Settings.css';

const MONTHS = [
  { v: 1, l: 'January' }, { v: 4, l: 'April' }, { v: 7, l: 'July' }, { v: 10, l: 'October' },
];

const NOTIF_KEY = 'cashflow.notifications';
const DEFAULT_NOTIFS = { overdueAlerts: true, paymentReminders: true, weeklyDigest: false };

export default function SettingsClient({ currency, fyStartMonth, country, role, businessName, industry }: any) {
  const router = useRouter();
  const canWrite = role === 'Admin' || role === 'Accountant';
  const isAdmin = role === 'Admin';

  const [prefs, setPrefs] = useState({ currency, fyStartMonth: Number(fyStartMonth), country });
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [busy, setBusy] = useState('');

  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) setNotifs({ ...DEFAULT_NOTIFS, ...JSON.parse(raw) });
    } catch {}
  }, []);
  const toggleNotif = (k: keyof typeof DEFAULT_NOTIFS) => {
    const next = { ...notifs, [k]: !notifs[k] };
    setNotifs(next);
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
  };

  const savePrefs = async () => {
    setBusy('prefs');
    try {
      await fetch('/api/user/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs),
      });
      setSavedPrefs(true);
      router.refresh();
      setTimeout(() => setSavedPrefs(false), 2500);
    } finally { setBusy(''); }
  };

  const regenerate = async () => {
    if (!confirm('Regenerate a fresh industry-based sample ledger? This replaces current transactions, invoices, bills and contacts.')) return;
    setBusy('regen');
    try {
      const res = await fetch('/api/bank/connect', { method: 'POST' });
      const data = await res.json();
      alert(res.ok ? `Imported ${data.imported} transactions. Dashboard refreshed.` : (data.error || 'Failed'));
      router.refresh();
    } finally { setBusy(''); }
  };

  const wipe = async () => {
    if (!confirm('Delete ALL transactions, invoices, bills and contacts for this business? This cannot be undone.')) return;
    setBusy('wipe');
    try {
      const res = await fetch('/api/data/reset', { method: 'POST' });
      alert(res.ok ? 'All business data cleared.' : ((await res.json()).error || 'Failed'));
      router.refresh();
    } finally { setBusy(''); }
  };

  return (
    <div className="settings-container animate-fade-in">
      <div className="mb-6">
        <h1 className="text-h1">Settings</h1>
        <p className="text-muted">{businessName} · {industry}</p>
      </div>

      {/* Financial preferences */}
      <section className="settings-card glass-panel">
        <div className="settings-head"><span className="settings-icon"><SlidersHorizontal size={18} /></span><div><h2 className="text-h2">Financial Preferences</h2><p className="text-muted text-sm">Currency and reporting period used across the app.</p></div></div>
        <div className="settings-grid">
          <div className="form-group"><label>Currency</label>
            <select className="input-field" value={prefs.currency} disabled={!canWrite} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}>
              <option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option><option value="AUD">AUD (A$)</option>
            </select>
          </div>
          <div className="form-group"><label>Financial Year Start</label>
            <select className="input-field" value={prefs.fyStartMonth} disabled={!canWrite} onChange={(e) => setPrefs({ ...prefs, fyStartMonth: Number(e.target.value) })}>
              {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Country</label>
            <select className="input-field" value={prefs.country} disabled={!canWrite} onChange={(e) => setPrefs({ ...prefs, country: e.target.value })}>
              {['India', 'USA', 'UK', 'Australia'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {canWrite && (
          <div className="flex-between mt-4">
            {savedPrefs ? <span className="text-success text-sm">✓ Saved</span> : <span />}
            <button className="btn-primary" onClick={savePrefs} disabled={busy === 'prefs'}>{busy === 'prefs' ? 'Saving…' : 'Save Preferences'}</button>
          </div>
        )}
      </section>

      {/* Notifications */}
      <section className="settings-card glass-panel">
        <div className="settings-head"><span className="settings-icon"><Bell size={18} /></span><div><h2 className="text-h2">Notifications</h2><p className="text-muted text-sm">Choose what CashFlow Pro alerts you about.</p></div></div>
        {([['overdueAlerts', 'Overdue invoice & bill alerts'], ['paymentReminders', 'Payment reminder emails to customers'], ['weeklyDigest', 'Weekly cash-flow digest']] as const).map(([k, label]) => (
          <div key={k} className="toggle-row">
            <span>{label}</span>
            <button className={`toggle ${notifs[k] ? 'on' : ''}`} onClick={() => toggleNotif(k)} aria-pressed={notifs[k]}><span className="toggle-knob" /></button>
          </div>
        ))}
      </section>

      {/* Data management */}
      {canWrite && (
        <section className="settings-card glass-panel">
          <div className="settings-head"><span className="settings-icon"><Database size={18} /></span><div><h2 className="text-h2">Sample Data</h2><p className="text-muted text-sm">Regenerate a realistic {industry} ledger to explore the app.</p></div></div>
          <button className="btn-secondary" onClick={regenerate} disabled={busy === 'regen'}><RefreshCw size={16} /> {busy === 'regen' ? 'Regenerating…' : 'Regenerate Sample Ledger'}</button>
        </section>
      )}

      {/* Danger zone */}
      {isAdmin && (
        <section className="settings-card glass-panel danger-zone">
          <div className="settings-head"><span className="settings-icon danger"><AlertOctagon size={18} /></span><div><h2 className="text-h2">Danger Zone</h2><p className="text-muted text-sm">Permanently clear all financial records for this business.</p></div></div>
          <button className="btn-danger" onClick={wipe} disabled={busy === 'wipe'}><Trash2 size={16} /> {busy === 'wipe' ? 'Clearing…' : 'Clear All Business Data'}</button>
        </section>
      )}
    </div>
  );
}
