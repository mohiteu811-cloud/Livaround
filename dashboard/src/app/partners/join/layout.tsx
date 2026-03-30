import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the LivAround Partner Program',
  description: 'Earn up to 25% recurring commission by referring property managers to LivAround.',
};

export default function PartnerJoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
