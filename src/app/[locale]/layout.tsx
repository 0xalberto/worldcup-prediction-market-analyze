import type { Metadata } from 'next';
import { Geist, Montserrat, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PageBackground } from '@/components/layout/PageBackground';
import '../globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const display = Montserrat({ subsets: ['latin'], variable: '--font-display', weight: ['100', '300', '400', '500', '600', '700', '800', '900'] });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as 'es' | 'en')) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${geist.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-bg-0 text-fg-1 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PageBackground />
          <Header />
          <main className="relative z-10">{children}</main>
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
