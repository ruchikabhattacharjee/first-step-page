'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import './Onboarding.css';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [baseline, setBaseline] = useState({
    bankBalance: '',
    receivables: '',
    payables: ''
  });
  
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState('');
  const [bankCreds, setBankCreds] = useState({ account: '', ifsc: '' });

  const [saving, setSaving] = useState(false);

  const handleBaselineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Persist the day-zero balance to the logged-in user's account.
      await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankBalance: baseline.bankBalance }),
      });
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const finishSetup = async () => {
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupComplete: true }),
    });
    router.push('/');
    router.refresh();
  };

  const openBankModal = (bank: string) => {
    setSelectedBank(bank);
    setBankModalOpen(true);
  };

  const handleBankConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    // Generate a realistic 90-day transaction history for this business.
    const res = await fetch('/api/bank/connect', { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    setBankModalOpen(false);
    setSaving(false);
    alert(res.ok
      ? `Imported ${data.imported} transactions from ${selectedBank}. Your dashboard is now live!`
      : 'Could not import transactions. You can still continue and add data manually.');
    await finishSetup();
  };

  const skipBank = () => {
    finishSetup();
  };

  return (
    <div className="onboarding-container glass-panel">
      <div className="signup-header">
        <h1 className="text-gradient">Day-Zero Setup</h1>
        <p className="text-muted">Let's initialize your financial state.</p>
      </div>

      {step === 1 && (
        <form onSubmit={handleBaselineSubmit} className="signup-form animate-fade-in">
          <div className="form-group mb-6">
            <h2 className="text-h2">Starting Balances</h2>
            <p className="text-muted">Enter your actual financial position as of today.</p>
          </div>

          <div className="form-group">
            <label>Current Bank Balance (₹)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="e.g. 500000"
              value={baseline.bankBalance}
              onChange={(e) => setBaseline({...baseline, bankBalance: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Total Outstanding Receivables (₹)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="Money owed to you"
              value={baseline.receivables}
              onChange={(e) => setBaseline({...baseline, receivables: e.target.value})}
              required
            />
          </div>

          <div className="form-group">
            <label>Total Outstanding Payables (₹)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="Money you owe"
              value={baseline.payables}
              onChange={(e) => setBaseline({...baseline, payables: e.target.value})}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-4" disabled={saving}>
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="bank-integration animate-fade-in">
          <div className="form-group text-center mb-6">
            <h2 className="text-h2">Connect Your Bank</h2>
            <p className="text-muted mt-2">
              Sync your transactions automatically to save time.
            </p>
          </div>

          <div className="bank-grid">
            {['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak'].map(bank => (
              <button 
                key={bank} 
                className="bank-card glass-card"
                onClick={() => openBankModal(bank)}
              >
                {bank}
              </button>
            ))}
          </div>

          <button onClick={skipBank} className="btn-secondary w-full mt-6">
            Skip for now
          </button>
        </div>
      )}

      {bankModalOpen && (
        <div className="modal-overlay flex-center">
          <div className="modal-content glass-panel animate-fade-in">
            <h2 className="text-h2 mb-4">Connect {selectedBank}</h2>
            <form onSubmit={handleBankConfirm} className="signup-form">
              <div className="form-group">
                <label>Account Number</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  value={bankCreds.account}
                  onChange={(e) => setBankCreds({...bankCreds, account: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input 
                  type="text" 
                  className="input-field" 
                  required
                  value={bankCreds.ifsc}
                  onChange={(e) => setBankCreds({...bankCreds, ifsc: e.target.value})}
                />
              </div>
              <div className="flex-between mt-4">
                <button type="button" className="btn-secondary" onClick={() => setBankModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
