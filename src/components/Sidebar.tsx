'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Receipt, PieChart, Settings, Users, Wallet } from 'lucide-react';
import './Sidebar.css';

export const Sidebar = () => {
  const pathname = usePathname();
  
  const navItems = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Invoices (AR)', path: '/invoices', icon: <FileText size={20} /> },
    { name: 'Bills (AP)', path: '/bills', icon: <Receipt size={20} /> },
    { name: 'Analytics', path: '/analytics', icon: <PieChart size={20} /> },
    { name: 'Contacts', path: '/contacts', icon: <Users size={20} /> },
  ];

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-brand">
        <span className="brand-mark"><Wallet size={20} /></span>
        <h2 className="text-gradient">CashFlow Pro</h2>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link key={item.name} href={item.path} className={`nav-item ${pathname === item.path ? 'active' : ''}`}>
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
};
