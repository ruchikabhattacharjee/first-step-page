'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { initials } from '@/lib/format';
import { UserPlus, Trash, X, Shield, KeyRound } from 'lucide-react';
import { PasswordResetForm } from '@/components/PasswordResetForm';
import './Profile.css';

const INDUSTRIES = ['Retail', 'Food & Beverage', 'Manufacturing', 'Professional Services', 'Freelancer', 'Healthcare', 'Education', 'Construction', 'Other'];
const MONTHS = [{ v: '1', l: 'January' }, { v: '4', l: 'April' }, { v: '7', l: 'July' }, { v: '10', l: 'October' }];
const ROLES = ['Admin', 'Accountant', 'Viewer'];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>(null);

  // ---- team state ----
  const [team, setTeam] = useState<any | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'Viewer' });
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState<{ tempPassword: string; emailed: boolean; name: string } | null>(null);

  // ---- password change ----
  const [pwOpen, setPwOpen] = useState(false);
  const [pwDone, setPwDone] = useState(false);

  const loadTeam = useCallback(() => {
    fetch('/api/team').then((r) => (r.ok ? r.json() : null)).then((d) => d && setTeam(d)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setForm(data.user); loadTeam(); })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false));
  }, [router, loadTeam]);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setForm((await res.json()).user);
      setSavedAt(Date.now());
      router.refresh();
    } catch { setError('Could not save changes. Please try again.'); } finally { setSaving(false); }
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteBusy(true); setInviteError(''); setInviteResult(null);
    try {
      const res = await fetch('/api/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invite),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add member');
      setInviteResult({ tempPassword: data.tempPassword, emailed: data.emailed, name: invite.name });
      setInvite({ name: '', email: '', role: 'Viewer' });
      loadTeam();
    } catch (err: any) { setInviteError(err.message); } finally { setInviteBusy(false); }
  };

  const changeRole = async (id: string, role: string) => {
    const res = await fetch(`/api/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    });
    if (res.ok) loadTeam(); else alert((await res.json()).error || 'Failed');
  };

  const removeMember = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the business?`)) return;
    const res = await fetch(`/api/team/${id}`, { method: 'DELETE' });
    if (res.ok) loadTeam(); else alert((await res.json()).error || 'Failed');
  };

  if (loading || !form) {
    return <div className="profile-container"><p className="text-muted">Loading profile…</p></div>;
  }

  const isAdmin = form.role === 'Admin';

  return (
    <div className="profile-container animate-fade-in">
      <div className="profile-hero glass-panel">
        <div className="profile-avatar flex-center">{initials(form.name)}</div>
        <div>
          <h1 className="text-h1">{form.name}</h1>
          <p className="text-muted">{form.businessName || 'Your business'} · {form.email}</p>
          <span className="status-pill status-green" style={{ marginTop: '0.5rem', display: 'inline-block' }}>{form.role}</span>
        </div>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}
      {savedAt && !error && <div className="alert-success mb-4">Profile updated successfully.</div>}

      <form onSubmit={handleSave} className="profile-form glass-panel">
        <h2 className="text-h2 mb-4">Account Details</h2>
        <div className="profile-grid">
          <div className="form-group"><label>Full Name</label><input className="input-field" value={form.name || ''} onChange={(e) => update('name', e.target.value)} required /></div>
          <div className="form-group"><label>Business Name</label><input className="input-field" value={form.businessName || ''} onChange={(e) => update('businessName', e.target.value)} /></div>
          <div className="form-group"><label>Email <span className="text-xs text-muted">(cannot be changed)</span></label><input className="input-field" value={form.email || ''} disabled /></div>
          <div className="form-group"><label>Industry</label>
            <select className="input-field" value={form.industry || ''} onChange={(e) => update('industry', e.target.value)}>
              <option value="" disabled>Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Country</label>
            <select className="input-field" value={form.country || 'India'} onChange={(e) => update('country', e.target.value)}>
              {['India', 'USA', 'UK', 'Australia'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Currency</label>
            <select className="input-field" value={form.currency || 'INR'} onChange={(e) => update('currency', e.target.value)}>
              <option value="INR">INR (₹)</option><option value="USD">USD ($)</option><option value="GBP">GBP (£)</option><option value="AUD">AUD (A$)</option>
            </select>
          </div>
          <div className="form-group"><label>Financial Year Start</label>
            <select className="input-field" value={String(form.fyStartMonth || 4)} onChange={(e) => update('fyStartMonth', e.target.value)}>
              {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          {!form.businessId && (
            <div className="form-group"><label>Current Bank Balance</label><input type="number" className="input-field" value={form.bankBalance ?? 0} onChange={(e) => update('bankBalance', e.target.value)} /></div>
          )}
        </div>
        <div className="flex-between mt-6">
          <button type="button" className="btn-secondary" onClick={() => router.push('/')}>Back to Dashboard</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>

      {/* ---- Security ---- */}
      <div className="profile-form glass-panel mt-6">
        <div className="flex-between">
          <div>
            <h2 className="text-h2 flex-center" style={{ gap: 8, justifyContent: 'flex-start' }}><KeyRound size={20} /> Security</h2>
            <p className="text-muted text-sm mt-1">Change your password. We&apos;ll email a verification code to {form.email}.</p>
          </div>
          <button className="btn-secondary" onClick={() => { setPwOpen(true); setPwDone(false); }}>Change Password</button>
        </div>
      </div>

      {/* ---- Team & Access (Admin only) ---- */}
      {isAdmin && team && (
        <div className="profile-form glass-panel mt-6">
          <div className="flex-between mb-1">
            <h2 className="text-h2 flex-center" style={{ gap: 8, justifyContent: 'flex-start' }}><Shield size={20} /> Team & Access</h2>
            <button className="btn-primary" onClick={() => { setInviteOpen(true); setInviteResult(null); setInviteError(''); }}><UserPlus size={16} /> Add Member</button>
          </div>
          <p className="text-muted text-sm mb-4">Invite employees and control what they can do. <strong>Admin</strong> & <strong>Accountant</strong> can edit; <strong>Viewer</strong> is read-only.</p>

          <table className="data-table">
            <thead><tr><th>Member</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>
              {team.members.map((m: any) => (
                <tr key={m.id}>
                  <td className="font-semibold flex-center" style={{ gap: 8, justifyContent: 'flex-start' }}>
                    <span className="member-avatar">{initials(m.name)}</span>
                    {m.name} {m.isOwner && <span className="status-pill status-gray">Owner</span>}
                  </td>
                  <td className="text-muted">{m.email}</td>
                  <td>
                    {m.isOwner ? (
                      <span className="status-pill status-green">{m.role}</span>
                    ) : (
                      <select className="input-field role-select" value={m.role} onChange={(e) => changeRole(m.id, e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td>
                    {!m.isOwner && m.id !== form.id ? (
                      <button className="action-btn text-danger" title="Remove" onClick={() => removeMember(m.id, m.name)}><Trash size={16} /></button>
                    ) : <span className="text-xs text-muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <div className="modal-overlay" onClick={() => setInviteOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4"><h2 className="text-h2">Add Team Member</h2><button className="action-btn" onClick={() => setInviteOpen(false)}><X size={18} /></button></div>

            {inviteResult ? (
              <div>
                <div className="alert-success mb-4">{inviteResult.name} was added to your business.</div>
                <p className="text-sm mb-2">Share these temporary credentials so they can sign in:</p>
                <div className="cred-box">
                  <div><span className="text-muted text-xs">Temporary password</span><div className="font-bold" style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{inviteResult.tempPassword}</div></div>
                </div>
                <p className="text-xs text-muted mt-2">{inviteResult.emailed ? 'An email with these details was also sent to them.' : 'Email could not be delivered on this network — share the password manually.'}</p>
                <div className="flex-between mt-4 gap-2">
                  <button className="btn-secondary" onClick={() => setInviteResult(null)}>Add Another</button>
                  <button className="btn-primary" onClick={() => setInviteOpen(false)}>Done</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitInvite}>
                {inviteError && <div className="alert-error mb-4">{inviteError}</div>}
                <div className="form-group"><label>Full Name</label><input className="input-field" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} required /></div>
                <div className="form-group"><label>Email</label><input type="email" className="input-field" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required /></div>
                <div className="form-group"><label>Role</label>
                  <select className="input-field" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex-between mt-4 gap-2">
                  <button type="button" className="btn-secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={inviteBusy}>{inviteBusy ? 'Adding…' : 'Add Member'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Change password modal */}
      {pwOpen && (
        <div className="modal-overlay" onClick={() => setPwOpen(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4"><h2 className="text-h2">Change Password</h2><button className="action-btn" onClick={() => setPwOpen(false)}><X size={18} /></button></div>
            {pwDone ? (
              <div>
                <div className="alert-success mb-4">Your password has been updated.</div>
                <button className="btn-primary w-full" onClick={() => setPwOpen(false)}>Done</button>
              </div>
            ) : (
              <PasswordResetForm fixedEmail={form.email} submitLabel="Update Password" onDone={() => setPwDone(true)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
