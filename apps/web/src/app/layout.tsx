import type { Metadata } from 'next';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
