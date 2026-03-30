import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/theme';
import { ReferralCapture } from '@/components/ReferralCapture';
import './globals.css';

export const metadata: Metadata = {
  title: 'LivAround — Host Dashboard',
  description: 'Manage your LivAround properties, bookings, staff and inventory',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ReferralCapture />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
