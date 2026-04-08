import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sophia Platform',
  description: 'AI-powered autonomous software generation platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
