import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/Toast';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Providers } from './providers';
import { cn } from "@/lib/utils";

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
    <html lang="th" className={cn("dark")}>
      <body className="antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-lg focus:outline-none">
          Skip to main content
        </a>
        <Providers>
          <TooltipProvider>
            <ToastProvider>
              <main id="main-content">{children}</main>
            </ToastProvider>
            <Toaster />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
