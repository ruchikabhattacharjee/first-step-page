'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import '../signup/Signup.css';
import { PasswordResetForm } from '@/components/PasswordResetForm';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [notice, setNotice] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        // Refresh router so middleware picks up the cookie
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Login failed');
        if (data.unverified) {
          // In a full app, we'd redirect to a re-verify page. 
          // For now, they must signup again to trigger OTP.
        }
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'forgot') {
    return (
      <div className="signup-container glass-panel">
        <div className="signup-header">
          <h1 className="text-gradient">Reset Password</h1>
          <p className="text-muted">We&apos;ll email you a code to set a new password.</p>
        </div>
        <div className="signup-form animate-fade-in">
          <PasswordResetForm
            submitLabel="Set New Password"
            onDone={() => {
              setMode('login');
              setNotice('Password updated. Please sign in with your new password.');
            }}
          />
          <button type="button" className="link-btn mt-4" style={{ margin: '1rem auto 0', display: 'flex' }} onClick={() => setMode('login')}>
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signup-container glass-panel">
      <div className="signup-header">
        <h1 className="text-gradient">CashFlow Pro</h1>
        <p className="text-muted">Welcome back to your dashboard</p>
      </div>

      {notice && <div className="alert-success mb-4">{notice}</div>}
      {error && <div className="alert-error mb-4">{error}</div>}

      <form onSubmit={handleLogin} className="signup-form animate-fade-in">
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            className="input-field"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            required
          />
        </div>

        <div className="form-group">
          <div className="flex-between">
            <label>Password</label>
            <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }}>Forgot password?</button>
          </div>
          <input
            type="password"
            className="input-field"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-muted mt-4">
          Don't have an account? <Link href="/signup" className="text-primary font-semibold">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
