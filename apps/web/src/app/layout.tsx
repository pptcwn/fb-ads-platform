import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'FB Ads Platform',
  description: 'Facebook Ads Multi-Account Automation Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="dark">
      <body
        className="antialiased"
        style={{
          fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif",
          fontFeatureSettings: "'liga' 1",
        }}
      >
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:outline-none">
          Skip to main content
        </a>
        <ToastProvider>
          <main id="main-content">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
