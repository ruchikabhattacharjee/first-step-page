'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, User, ChevronDown, Lock } from 'lucide-react';
import { formatCurrency, initials } from '@/lib/format';
import './Header.css';

type Me = {
  name: string;
  businessName: string;
  bankBalance: number;
  currency: string;
  role: string;
};

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadMe = useCallback(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setMe(data.user))
      .catch(() => {});
  }, []);

  // Refresh on mount, on route change, and whenever a mutation broadcasts that
  // balance-affecting data changed (e.g. a bill/invoice was marked paid).
  useEffect(() => { loadMe(); }, [loadMe, pathname]);
  useEffect(() => {
    const onRefresh = () => loadMe();
    window.addEventListener('cashflow:refresh', onRefresh);
    return () => window.removeEventListener('cashflow:refresh', onRefresh);
  }, [loadMe]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="header glass-card">
      <div className="header-greeting">
        <span className="kpi-label">Welcome back</span>
        <span className="header-name">{me?.name || '…'}</span>
        {me?.businessName && <span className="header-business">{me.businessName}</span>}
      </div>

      <div className="header-kpi-container">
        <div className="kpi-item">
          <span className="kpi-label">Current Bank Balance</span>
          {me && me.role === 'Viewer' ? (
            <span className="kpi-value text-h2 balance-hidden" title="Hidden for your role">
              <span className="balance-amount">{formatCurrency(me.bankBalance, me.currency)}</span>
              <span className="balance-lock"><Lock size={13} /> Restricted</span>
            </span>
          ) : (
            <span className="kpi-value text-h2">
              {me ? formatCurrency(me.bankBalance, me.currency) : '—'}
            </span>
          )}
        </div>
      </div>

      <div className="header-actions" ref={menuRef}>
        <button className="profile-trigger" onClick={() => setMenuOpen((o) => !o)}>
          <div className="user-avatar flex-center">{initials(me?.name)}</div>
          <ChevronDown size={16} className="text-muted" />
        </button>

        {menuOpen && (
          <div className="profile-menu glass-panel animate-fade-in">
            <div className="profile-menu-head">
              <div className="user-avatar flex-center">{initials(me?.name)}</div>
              <div>
                <div className="font-semibold">{me?.name}</div>
                <div className="text-xs text-muted">{me?.businessName}</div>
              </div>
            </div>
            <Link href="/profile" className="profile-menu-item" onClick={() => setMenuOpen(false)}>
              <User size={16} /> View Profile
            </Link>
            <button onClick={handleLogout} className="profile-menu-item profile-menu-item--danger">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
