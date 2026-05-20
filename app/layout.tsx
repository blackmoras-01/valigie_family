import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Valigie — Family Luggage Tracker',
  description: 'Track your family luggage across the globe.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
