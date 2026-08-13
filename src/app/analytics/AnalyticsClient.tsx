'use client';

import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import './Analytics.css';
import { HelpTooltip } from '@/components/Tooltip';
import { ChartBox } from '@/components/ChartBox';
import { formatCurrency } from '@/lib/format';

export default function AnalyticsClient({ currency, statement, budgetActuals, projection }: any) {
  const [activeTab, setActiveTab] = useState<'cashflows' | 'projections' | 'budgets'>('cashflows');
  const [horizon, setHorizon] = useState<30 | 60 | 90>(90);
  const fmt = (n: number) => formatCurrency(n, currency);

  const netOperating = statement.operating.in - statement.operating.out;
  const netInvesting = statement.investing.in - statement.investing.out;
  const netFinancing = statement.financing.in - statement.financing.out;

  const series = projection.series.filter((s: any) => Number(s.day) <= horizon);

  return (
    <div className="analytics-container animate-fade-in">
      <div className="flex-between mb-6">
        <h2 className="text-h2">High-Impact Visual Analytics</h2>
        <div className="tab-controls glass-panel">
          <button className={`tab-btn ${activeTab === 'cashflows' ? 'active' : ''}`} onClick={() => setActiveTab('cashflows')}>Statement of Cash Flows</button>
          <button className={`tab-btn ${activeTab === 'projections' ? 'active' : ''}`} onClick={() => setActiveTab('projections')}>Projections</button>
          <button className={`tab-btn ${activeTab === 'budgets' ? 'active' : ''}`} onClick={() => setActiveTab('budgets')}>Budget vs Actuals</button>
        </div>
      </div>

      <div className="analytics-content glass-panel">
        {activeTab === 'cashflows' && (
          <div className="animate-fade-in">
            <h3 className="font-semibold mb-4 text-h2">Statement of Cash Flows <span className="text-muted text-sm">(This Month)</span></h3>
            <div className="cash-flow-table mb-6">
              <div className="cf-row font-bold"><span className="flex-center" style={{ gap: 4, justifyContent: 'flex-start' }}>Opening Cash Balance <HelpTooltip content="The total cleared funds available at the start of the period." /></span><span>{fmt(statement.opening)}</span></div>

              <div className="cf-row group-header">Operating Activities <HelpTooltip content="Everyday running costs: customer collections, salaries, rent, utilities." /></div>
              <div className="cf-row sub"><span>Cash Inflows</span><span className="text-success">+{fmt(statement.operating.in)}</span></div>
              <div className="cf-row sub"><span>Cash Outflows</span><span className="text-danger">-{fmt(statement.operating.out)}</span></div>
              <div className="cf-row sub-total font-semibold"><span>Net Operating</span><span>{netOperating >= 0 ? '+' : '-'}{fmt(Math.abs(netOperating))}</span></div>

              <div className="cf-row group-header">Investing Activities <HelpTooltip content="Buying or selling long-term assets like equipment." /></div>
              <div className="cf-row sub"><span>Cash Inflows</span><span className="text-success">+{fmt(statement.investing.in)}</span></div>
              <div className="cf-row sub"><span>Cash Outflows</span><span className="text-danger">-{fmt(statement.investing.out)}</span></div>
              <div className="cf-row sub-total font-semibold"><span>Net Investing</span><span>{netInvesting >= 0 ? '+' : '-'}{fmt(Math.abs(netInvesting))}</span></div>

              <div className="cf-row group-header">Financing Activities <HelpTooltip content="Equity injections, loans, and owner distributions." /></div>
              <div className="cf-row sub"><span>Cash Inflows</span><span className="text-success">+{fmt(statement.financing.in)}</span></div>
              <div className="cf-row sub"><span>Cash Outflows</span><span className="text-danger">-{fmt(statement.financing.out)}</span></div>
              <div className="cf-row sub-total font-semibold"><span>Net Financing</span><span>{netFinancing >= 0 ? '+' : '-'}{fmt(Math.abs(netFinancing))}</span></div>

              <div className="cf-row font-bold closing-balance"><span>Closing Cash Balance</span><span>{fmt(statement.closing)}</span></div>
            </div>
          </div>
        )}

        {activeTab === 'projections' && (
          <div className="animate-fade-in">
            <div className="flex-between mb-4">
              <h3 className="font-semibold text-h2">Risk-Adjusted Balance Forecast</h3>
              <div className="tab-controls glass-card" style={{ padding: 4 }}>
                {[30, 60, 90].map((h) => (
                  <button key={h} className={`tab-btn ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h as any)}>{h}d</button>
                ))}
              </div>
            </div>
            <p className="text-muted mb-6 flex-center" style={{ justifyContent: 'flex-start', gap: 4 }}>
              Confirmed path discounts receivables by collection probability. <HelpTooltip content="Best case assumes optimal invoice collection; worst case models unexpected delays across your open customer bills." />
            </p>

            <ChartBox height={400} className="mb-6">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                  <XAxis dataKey="day" stroke="var(--text-secondary)" label={{ value: 'Days from today', position: 'insideBottom', offset: -3, fill: 'var(--text-secondary)' }} />
                  <YAxis stroke="var(--text-secondary)" tickFormatter={(v) => fmt(v)} width={90} />
                  <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--surface-border)', borderRadius: 8 }} />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--danger)" strokeWidth={2} strokeDasharray="4 4" label={{ value: 'Liquidity Risk', fill: 'var(--danger)', fontSize: 12 }} />
                  <Line type="monotone" dataKey="confirmed" name="Confirmed Path" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="bestCase" name="Best Case" stroke="var(--success)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="worstCase" name="Worst Case" stroke="var(--danger)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>

            <div className="insights-list">
              {projection.insights.map((text: string, i: number) => (
                <div key={i} className="alert-banner status-yellow glass-card mb-2"><strong>Insight:</strong> {text}</div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="animate-fade-in">
            <h3 className="font-semibold mb-4 text-h2">Budget vs Actuals <span className="text-muted text-sm">(This Month)</span></h3>
            {budgetActuals.length === 0 ? (
              <p className="text-muted">No budget targets set for this month yet.</p>
            ) : (
              <>
                <div className="budget-grid mb-8">
                  {budgetActuals.map((row: any) => {
                    const pct = row.budget > 0 ? Math.round((row.actual / row.budget) * 100) : 100;
                    const over = row.actual > row.budget;
                    const near = !over && pct >= 80;
                    const fillClass = over ? 'progress-fill--over' : near ? 'progress-fill--warn' : 'progress-fill--ok';
                    const diff = row.budget - row.actual;
                    return (
                      <div key={row.category} className="budget-item glass-card">
                        <div className="flex-between mb-2">
                          <span className="font-semibold">{row.category}</span>
                          <span className={`status-pill ${over ? 'status-red' : near ? 'status-yellow' : 'status-green'}`}>{over ? 'Over budget' : near ? 'Near limit' : 'On track'}</span>
                        </div>
                        <div className="progress-track">
                          <div className={`progress-fill ${fillClass}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <div className="flex-between mt-2 text-sm">
                          <span className="text-muted">{fmt(row.actual)} <span className="text-xs">of {fmt(row.budget)}</span></span>
                          <span className={diff < 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>{diff >= 0 ? '+' : '-'}{fmt(Math.abs(diff))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <h4 className="font-semibold mb-4">Variance Breakdown</h4>
                <ChartBox height={300}>
                  <ResponsiveContainer>
                    <BarChart data={budgetActuals} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" />
                      <XAxis dataKey="category" stroke="var(--text-secondary)" />
                      <YAxis stroke="var(--text-secondary)" tickFormatter={(v) => fmt(v)} width={90} />
                      <Tooltip formatter={(v: any) => fmt(v)} contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--surface-border)', borderRadius: 8 }} />
                      <Legend />
                      <Bar dataKey="budget" name="Budget Target" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Outflow" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartBox>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
