import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HajPogodi',
    template: '%s · HajPogodi',
  },
  description: 'Prognoziraj točan rezultat Hajdukovih utakmica i dokaži da znaš bolje od ostalih.',
  applicationName: 'HajPogodi',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0a1729',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
