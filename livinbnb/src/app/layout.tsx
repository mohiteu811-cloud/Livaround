import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Livinbnb — Home Exchange, Reimagined',
  description:
    'Stop sending individual swap requests. Livinbnb finds 2, 3, and 4-way home exchanges automatically — so A goes to London, B goes to Barcelona, and C goes to Goa.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
