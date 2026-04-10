import type { Metadata } from 'next';
import { Syne, Space_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme/providers';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sophia Platform',
  description: 'AI-powered autonomous software generation platform',
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* Anti-flash: apply saved color theme before React hydrates */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sophia-color-theme');if(t&&t!=='emerald')document.documentElement.dataset.colorTheme=t;}catch(e){}try{var p=localStorage.getItem('sophia-dark-palette');if(p&&p!=='midnight')document.documentElement.dataset.darkPalette=p;}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${syne.variable} ${spaceMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
