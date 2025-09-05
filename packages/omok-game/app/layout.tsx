import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Omok Game - Five in a Row',
  description: 'Play Omok (Five in a Row) online with friends',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        {children}
      </body>
    </html>
  );
}