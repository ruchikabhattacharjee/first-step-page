import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SettingsClient from './SettingsClient';
import './Settings.css';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <SettingsClient
      currency={user.currency}
      fyStartMonth={user.fyStartMonth}
      country={user.country}
      role={user.role}
      businessName={user.businessName}
      industry={user.industry}
    />
  );
}
