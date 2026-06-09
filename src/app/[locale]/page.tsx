import { setRequestLocale } from 'next-intl/server';
import { Dashboard } from '@/components/Dashboard';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Dashboard />;
}
