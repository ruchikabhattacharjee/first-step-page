'use client';

import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, ArrowRight, Bell, X, Receipt, FileText, Download, CheckCircle,
} from 'lucide-react';
import { HelpTooltip } from '@/components/Tooltip';
import { ChartBox } from '@/components/ChartBox';
import { formatCurrency } from '@/lib/format';

const PIE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];

export default function DashboardClient({
  userName, businessName, currency = 'INR', role, netChange = 0, moneyIn, moneyOut,
  receivables, payables, transactions, upcomingBills, overdueInvoices, overdueBillCount,
  billDetails, chartData, expenseBreakdown, aging,
}: any) {
  const fmt = (n: number) => formatCurrency(n, currency);
  const canWrite = role === 'Admin' || role === 'Accountant';

  const [actionOpen, setActionOpen] = useState(false);
  const [txnOpen, setTxnOpen] = useState(false);
  const [remindBusy, setRemindBusy] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStage, setExportStage] = useState<'confirm' | 'preparing' | 'done'>('confirm');
  const [exportFile, setExportFile] = useState('');
  const [exportError, setExportError] = useState('');

  const buildFileName = () => {
    const slug = (businessName || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${slug}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.pdf`;
  };

  const openExport = () => {
    setExportFile(buildFileName());
    setExportStage('confirm');
    setExportError('');
    setExportOpen(true);
  };

  const confirmExport = async () => {
    setExportStage('preparing');
    setExportError('');
    try {
      const res = await fetch('/api/report/export');
      if (!res.ok) throw new Error('Could not generate the report. Please try again.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFile; // download uses the filename shown to the user
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportStage('done');
      setTimeout(() => setExportOpen(false), 1600);
    } catch (e: any) {
      setExportError(e.message || 'Export failed');
      setExportStage('confirm');
    }
  };

  const overdueInvTotal = overdueInvoices.reduce((s: number, i: any) => s + i.amount, 0);
  const actionCount = overdueInvoices.length + overdueBillCount;

  const sendReminder = async (invId: string) => {
    setRemindBusy(invId);
    try {
      const res = await fetch(`/api/invoices/${invId}/remind`, { method: 'POST' });
      const data = await res.json();
      alert(res.ok ? data.message : (data.error || 'Could not send reminder'));
    } finally {
      setRemindBusy(null);
    }
  };

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-heading flex-between mb-6">
        <div>
          <h1 className="text-h1">Hi {(userName || '').split(' ')[0] || 'there'} 👋</h1>
          <p className="text-muted">Here's how {businessName || 'your business'} is doing today.</p>
        </div>
        <div className="dashboard-heading-right">
          {canWrite && (
            <button className="btn-secondary export-btn" onClick={openExport}>
              <Download size={16} /> Export Report
            </button>
          )}
          <div className="net-change-chip glass-card">
            <span className="text-xs text-muted uppercase">30-Day Net Cash Change</span>
            <span className={`text-h2 ${netChange >= 0 ? 'text-success' : 'text-danger'}`}>
              {netChange >= 0 ? '+' : '-'}{fmt(Math.abs(netChange))}
            </span>
          </div>
        </div>
      </div>

      {/* Action Center — overdue invoices & bills in their own clickable box */}
      {actionCount > 0 && (
        <div className="action-center glass-card clickable mb-6" onClick={() => setActionOpen(true)}>
          <div className="action-icon"><AlertTriangle size={22} /></div>
          <div className="action-body">
            <span className="font-bold">Action Center — {actionCount} item{actionCount > 1 ? 's' : ''} need attention</span>
            <span className="text-sm text-muted">
              {overdueInvoices.length} overdue invoice{overdueInvoices.length !== 1 ? 's' : ''} ({fmt(overdueInvTotal)} to collect)
              {overdueBillCount > 0 && ` · ${overdueBillCount} overdue bill${overdueBillCount > 1 ? 's' : ''} to pay`}
            </span>
          </div>
          <button className="btn-secondary action-cta">Review <ArrowRight size={16} /></button>
        </div>
      )}

      <div className="quick-stats-grid mb-6">
        <div className="stat-card glass-card accent-success">
          <div className="flex-between">
            <span className="text-muted text-sm uppercase">Money In (30d)</span>
            <span className="stat-icon stat-icon--success"><ArrowDownLeft size={16} /></span>
          </div>
          <div className="text-h2 mt-2">{fmt(moneyIn || 0)}</div>
        </div>
        <div className="stat-card glass-card accent-danger">
          <div className="flex-between">
            <span className="text-muted text-sm uppercase">Money Out (30d)</span>
            <span className="stat-icon stat-icon--danger"><ArrowUpRight size={16} /></span>
          </div>
          <div className="text-h2 mt-2">{fmt(moneyOut || 0)}</div>
        </div>
        <div className="stat-card glass-card accent-info">
          <div className="flex-between">
            <span className="text-muted text-sm uppercase">Receivables Due</span>
            <HelpTooltip content="Total outstanding customer invoices still to be collected." />
          </div>
          <div className="text-h2 mt-2">{fmt(receivables)}</div>
        </div>
        <div className="stat-card glass-card accent-warning">
          <div className="flex-between">
            <span className="text-muted text-sm uppercase">Payables Due</span>
            <HelpTooltip content="Total outstanding supplier bills you still owe." />
          </div>
          <div className="text-h2 mt-2">{fmt(payables)}</div>
        </div>
      </div>

      <div className="dashboard-main-grid mb-6">
        <div className="chart-section glass-panel">
          <h2 className="text-h2 mb-4">30-Day Cash Flow</h2>
          <ChartBox height={300}>
            <ResponsiveContainer>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} width={70} tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--surface-border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="Inflows" stroke="var(--success)" strokeWidth={2.5} fill="url(#inGrad)" />
                <Area type="monotone" dataKey="Outflows" stroke="var(--danger)" strokeWidth={2.5} fill="url(#outGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>

        <div className="side-widgets">
          <div className="widget glass-card mb-4">
            <h3 className="font-semibold mb-3">Upcoming Bills</h3>
            {upcomingBills.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">Nothing due soon 🎉</p>
            ) : (
              <ul className="widget-list">
                {upcomingBills.map((bill: any) => (
                  <li key={bill.id} className="flex-between">
                    <span>{bill.category} <span className="text-xs text-muted">(Due in {Math.max(0, Math.ceil((new Date(bill.dueDate).getTime() - Date.now()) / 86400000))}d)</span></span>
                    <span className="font-bold">{fmt(bill.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="widget glass-card">
            <div className="flex-between mb-3">
              <h3 className="font-semibold">Recent Transactions</h3>
              <button className="link-btn" onClick={() => setTxnOpen(true)}>View all <ArrowRight size={14} /></button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No Transactions</p>
            ) : (
              <ul className="widget-list">
                {transactions.slice(0, 6).map((tx: any) => (
                  <li key={tx.id} className="flex-between">
                    <div className="tx-info">
                      <span>{tx.description}</span>
                      <span className="text-xs text-muted block">{new Date(tx.date).toLocaleDateString()} · {tx.category || tx.tag}</span>
                    </div>
                    <span className={`font-bold ${tx.type === 'IN' ? 'text-success' : 'text-danger'}`}>
                      {tx.type === 'IN' ? '+' : '-'}{fmt(tx.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Insight charts */}
      <div className="insight-grid mb-6">
        <div className="chart-section glass-panel">
          <h3 className="font-semibold mb-1">Where the Money Goes</h3>
          <p className="text-xs text-muted mb-3">Expenses by category — last 30 days</p>
          {expenseBreakdown.length === 0 ? (
            <p className="text-muted text-sm text-center py-6">No expenses recorded yet.</p>
          ) : (
            <ChartBox height={260}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {expenseBreakdown.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: any) => [fmt(v), n]} contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--surface-border)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
          <div className="legend-row">
            {expenseBreakdown.slice(0, 6).map((e: any, i: number) => (
              <span key={e.name} className="legend-item">
                <span className="legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {e.name} <span className="text-muted">{fmt(e.value)}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="chart-section glass-panel">
          <div className="flex-between mb-1">
            <h3 className="font-semibold">Receivables Aging</h3>
            <HelpTooltip content="How long your unpaid customer invoices have been outstanding. Older buckets are higher collection risk." />
          </div>
          <p className="text-xs text-muted mb-3">Outstanding invoices by how overdue they are</p>
          <ChartBox height={260}>
            <ResponsiveContainer>
              <BarChart data={aging} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} width={70} tickFormatter={(v) => fmt(v)} />
                <Tooltip
                  formatter={(v: any) => [fmt(v), 'Outstanding']}
                  cursor={{ fill: 'var(--primary-light)' }}
                  contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {aging.map((_: any, i: number) => <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444'][i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </div>
      </div>

      {/* ---- Action Center modal ---- */}
      {actionOpen && (
        <div className="modal-overlay" onClick={() => setActionOpen(false)}>
          <div className="modal-content modal-wide animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-4">
              <h2 className="text-h2">Action Center</h2>
              <button className="action-btn" onClick={() => setActionOpen(false)}><X size={18} /></button>
            </div>

            <h3 className="font-semibold mb-2 flex-center" style={{ justifyContent: 'flex-start', gap: 6 }}><FileText size={16} /> Overdue Invoices — money to collect</h3>
            {overdueInvoices.length === 0 ? (
              <p className="text-muted text-sm mb-4">No overdue invoices. 🎉</p>
            ) : (
              <ul className="action-list mb-6">
                {overdueInvoices.map((inv: any) => (
                  <li key={inv.id} className="action-row">
                    <div>
                      <span className="font-semibold">{inv.customer}</span>
                      <span className="text-xs text-muted block">{inv.invoiceNumber} · {inv.daysOverdue}d overdue · due {new Date(inv.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex-center" style={{ gap: 12 }}>
                      <span className="font-bold text-danger">{fmt(inv.amount)}</span>
                      {canWrite && (
                        <button className="btn-secondary btn-sm" disabled={remindBusy === inv.id || !inv.hasEmail}
                          title={inv.hasEmail ? 'Email a payment reminder' : 'No email on file for this customer'}
                          onClick={() => sendReminder(inv.id)}>
                          <Bell size={14} /> {remindBusy === inv.id ? 'Sending…' : 'Remind'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 className="font-semibold mb-2 flex-center" style={{ justifyContent: 'flex-start', gap: 6 }}><Receipt size={16} /> Bills to Pay</h3>
            {billDetails.length === 0 ? (
              <p className="text-muted text-sm">No open bills. 🎉</p>
            ) : (
              <ul className="action-list">
                {billDetails.map((b: any) => (
                  <li key={b.id} className="action-row">
                    <div>
                      <span className="font-semibold">{b.vendor}</span>
                      <span className="text-xs text-muted block">{b.billNumber} · {b.category} · {b.daysOverdue > 0 ? `${b.daysOverdue}d overdue` : `due ${new Date(b.dueDate).toLocaleDateString()}`}</span>
                    </div>
                    <span className={`font-bold ${b.daysOverdue > 0 ? 'text-danger' : ''}`}>{fmt(b.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ---- All transactions (bank feed) modal ---- */}
      {txnOpen && (
        <div className="modal-overlay" onClick={() => setTxnOpen(false)}>
          <div className="modal-content modal-wide animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-between mb-1">
              <h2 className="text-h2">All Transactions</h2>
              <button className="action-btn" onClick={() => setTxnOpen(false)}><X size={18} /></button>
            </div>
            <p className="text-muted text-sm mb-4">Imported bank feed · {transactions.length} most recent entries</p>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="text-muted">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="font-semibold">{tx.description}</td>
                    <td><span className="status-pill status-gray">{tx.category || tx.tag}</span></td>
                    <td>{tx.type === 'IN' ? 'Credit' : 'Debit'}</td>
                    <td className={`font-bold ${tx.type === 'IN' ? 'text-success' : 'text-danger'}`} style={{ textAlign: 'right' }}>
                      {tx.type === 'IN' ? '+' : '-'}{fmt(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Export report modal (confirm → prepare → download) ---- */}
      {exportOpen && (
        <div className="modal-overlay" onClick={() => exportStage !== 'preparing' && setExportOpen(false)}>
          <div className="modal-content animate-fade-in export-modal" onClick={(e) => e.stopPropagation()}>
            {exportStage === 'confirm' && (
              <>
                <div className="flex-between mb-3">
                  <h2 className="text-h2 flex-center" style={{ gap: 8, justifyContent: 'flex-start' }}><FileText size={20} /> Export Business Report</h2>
                  <button className="action-btn" onClick={() => setExportOpen(false)}><X size={18} /></button>
                </div>
                <p className="text-muted text-sm mb-3">A PDF snapshot with your KPIs, cash-flow chart, expense breakdown, receivables aging, statement of cash flows, budget vs actuals, forecast, and action items.</p>
                {exportError && <div className="alert-error mb-3">{exportError}</div>}
                <div className="export-file-box">
                  <span className="text-xs text-muted uppercase">File name</span>
                  <div className="export-file-name">{exportFile}</div>
                </div>
                <div className="flex-between mt-4 gap-2">
                  <button className="btn-secondary" onClick={() => setExportOpen(false)}>Cancel</button>
                  <button className="btn-primary" onClick={confirmExport}><Download size={16} /> Confirm &amp; Download</button>
                </div>
              </>
            )}
            {exportStage === 'preparing' && (
              <div className="export-status">
                <div className="report-spinner" />
                <p className="font-semibold mt-3">Preparing your report…</p>
                <p className="text-muted text-sm">Gathering insights and drawing charts.</p>
              </div>
            )}
            {exportStage === 'done' && (
              <div className="export-status">
                <CheckCircle size={44} className="text-success" />
                <p className="font-semibold mt-3">Report downloaded</p>
                <p className="text-muted text-sm">{exportFile}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
