'use client';

import { useState } from 'react';

interface Props {
  /** Pre-filled, locked email (the logged-in "change password" flow). */
  fixedEmail?: string;
  /** Called after the password is successfully changed. */
  onDone?: () => void;
  /** Label for the final submit button. */
  submitLabel?: string;
}

/**
 * Two-step email-OTP password reset, shared by the profile "Change Password"
 * modal and the login "Forgot password" panel.
 */
export function PasswordResetForm({ fixedEmail, onDone, submitLabel = 'Update Password' }: Props) {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState(fixedEmail || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/auth/password/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Could not send code. Try again.');
      setStep('confirm');
      setInfo(`If an account exists for ${email}, a 6-digit code is on its way.`);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update password.');
      onDone?.();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  if (step === 'request') {
    return (
      <form onSubmit={sendCode}>
        {error && <div className="alert-error mb-4">{error}</div>}
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" className="input-field" value={email} disabled={!!fixedEmail}
            onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <p className="text-xs text-muted mb-4">We&apos;ll email you a 6-digit verification code.</p>
        <button type="submit" className="btn-primary w-full" disabled={busy || !email}>
          {busy ? 'Sending…' : 'Send Verification Code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      {info && <div className="alert-success mb-4">{info}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}
      <div className="form-group">
        <label>Verification Code</label>
        <input className="input-field" value={otp} maxLength={6} placeholder="000000"
          onChange={(e) => setOtp(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>New Password</label>
        <input type="password" className="input-field" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      <div className="form-group">
        <label>Confirm New Password</label>
        <input type="password" className="input-field" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      <button type="submit" className="btn-primary w-full mt-2" disabled={busy}>
        {busy ? 'Updating…' : submitLabel}
      </button>
      <button type="button" className="link-btn mt-3" style={{ margin: '0.75rem auto 0', display: 'flex' }}
        onClick={() => { setStep('request'); setOtp(''); setError(''); }}>
        Didn&apos;t get a code? Resend
      </button>
    </form>
  );
}
