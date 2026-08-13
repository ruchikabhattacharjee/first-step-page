import AnalyticsClient from './AnalyticsClient';
import { getCurrentUser, tenantOf } from '@/lib/auth';
import { cashFlowStatement, budgetVsActuals, forecast } from '@/lib/analytics';

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const ownerId = tenantOf(user);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statement, budgets, projection] = await Promise.all([
    cashFlowStatement(ownerId, monthStart, now),
    budgetVsActuals(ownerId, now.getMonth() + 1, now.getFullYear()),
    forecast(ownerId, 90),
  ]);

  return (
    <AnalyticsClient
      currency={user.currency}
      statement={statement}
      budgetActuals={budgets}
      projection={projection}
    />
  );
}
