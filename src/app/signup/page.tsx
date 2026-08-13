'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import './Signup.css';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    businessType: '',
    otherBusinessType: '',
    country: 'India',
    currency: 'INR',
    fyStartMonth: '4',
    teamInvites: [] as {email: string, role: string}[]
  });
  const [otp, setOtp] = useState('');

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.fullName || !formData.email || !formData.password || !formData.businessType) {
      setError("Please fill all required fields");
      return;
    }
    if (formData.businessType === 'Other' && !formData.otherBusinessType) {
      setError("Please specify your business type");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        setStep(2);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, otp })
      });
      const data = await res.json();
      
      if (res.ok) {
        router.push('/onboarding');
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container glass-panel">
      <div className="signup-header">
        <h1 className="text-gradient">CashFlow Pro</h1>
        <p className="text-muted">Create your business account</p>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {step === 1 ? (
        <form onSubmit={handleNext} className="signup-form animate-fade-in">
          <div className="flex-between gap-4">
            <div className="form-group flex-1">
              <label>Full Name *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Business Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.businessName}
                onChange={(e) => setFormData({...formData, businessName: e.target.value})}
              />
            </div>
          </div>

          <div className="flex-between gap-4">
            <div className="form-group flex-1">
              <label>Email Address *</label>
              <input 
                type="email" 
                className="input-field" 
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="form-group flex-1">
              <label>Password *</label>
              <input 
                type="password" 
                className="input-field" 
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Business Type *</label>
            <select 
              className="input-field"
              value={formData.businessType}
              onChange={(e) => setFormData({...formData, businessType: e.target.value})}
              required
            >
              <option value="" disabled>Select your industry</option>
              <option value="Retail">Retail</option>
              <option value="Food & Beverage">Food & Beverage</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Professional Services">Professional Services</option>
              <option value="Freelancer">Freelancer</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Construction">Construction</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {formData.businessType === 'Other' && (
            <div className="form-group animate-fade-in">
              <label>Specify Business Type *</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.otherBusinessType}
                onChange={(e) => setFormData({...formData, otherBusinessType: e.target.value})}
                required
              />
            </div>
          )}

          <div className="flex-between gap-4">
            <div className="form-group flex-1">
              <label>Country</label>
              <select className="input-field" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})}>
                <option value="India">India</option>
                <option value="USA">USA</option>
                <option value="UK">UK</option>
                <option value="Australia">Australia</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label>Currency</label>
              <select className="input-field" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Financial Year Start Month</label>
            <select className="input-field" value={formData.fyStartMonth} onChange={e => setFormData({...formData, fyStartMonth: e.target.value})}>
              <option value="1">January</option>
              <option value="4">April</option>
              <option value="7">July</option>
              <option value="10">October</option>
            </select>
          </div>

          <div className="form-group mt-4 p-4" style={{ border: '1px dashed var(--surface-border)', borderRadius: '8px' }}>
            <div className="flex-between">
              <label>Team Invites (Optional)</label>
              <button type="button" className="text-primary text-sm font-semibold" onClick={() => setFormData({...formData, teamInvites: [...formData.teamInvites, {email: '', role: 'Viewer'}]})}>+ Add Member</button>
            </div>
            <p className="text-muted text-xs mb-2">Invite your accountant or co-founders with RBAC permissions.</p>
            {formData.teamInvites.map((invite, index) => (
              <div key={index} className="flex-between gap-2 mt-2">
                <input type="email" placeholder="Email" className="input-field flex-1" value={invite.email} onChange={(e) => {
                  const newInvites = [...formData.teamInvites];
                  newInvites[index].email = e.target.value;
                  setFormData({...formData, teamInvites: newInvites});
                }} />
                <select className="input-field" style={{ width: '120px' }} value={invite.role} onChange={(e) => {
                  const newInvites = [...formData.teamInvites];
                  newInvites[index].role = e.target.value;
                  setFormData({...formData, teamInvites: newInvites});
                }}>
                  <option value="Admin">Admin</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button type="button" className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }} onClick={() => {
                  const newInvites = formData.teamInvites.filter((_, i) => i !== index);
                  setFormData({...formData, teamInvites: newInvites});
                }}>✕</button>
              </div>
            ))}
          </div>

          <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>
            {loading ? 'Sending OTP...' : 'Create Account & Send OTP'}
          </button>
          
          <p className="text-center text-sm text-muted mt-4">
            Already have an account? <Link href="/login" className="text-primary font-semibold">Log in</Link>
          </p>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="signup-form animate-fade-in">
          <div className="form-group text-center mb-6">
            <h2 className="text-h2">Verify Email</h2>
            <p className="text-muted mt-2">
              We sent a 6-digit verification code to <strong>{formData.email}</strong>.
            </p>
          </div>

          <div className="form-group">
            <input 
              type="text" 
              className="input-field text-center text-h2" 
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-4" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
          
          <button type="button" onClick={() => setStep(1)} className="btn-secondary w-full mt-3" disabled={loading}>
            Back
          </button>
        </form>
      )}
    </div>
  );
}
