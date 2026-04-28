import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Bici Serial Tracker',
  description: 'Internal web app for Bici staff to track product serial numbers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navigation />
          <main className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
