import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'World Cup 2026 Simulator',
  description: 'Monte Carlo simulator with ELO + Poisson - 100,000 runs of the FIFA World Cup 2026.',
};

export const viewport: Viewport = {
  themeColor: 'oklch(0.13 0.02 260)',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
