import './globals.css';

export const metadata = {
  title: 'Kiff Sandbox Lite',
  description: 'Lightweight chat + preview workbench',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: 'no' as const,
  viewportFit: 'cover',
};

import { ThemeProvider } from '../components/theme/ThemeProvider';
import { LayoutStateProvider } from '../components/layout/LayoutState';
import { NextAuthProvider } from '../contexts/NextAuthProvider';
import { AuthProvider } from '../contexts/AuthContext';
import { PackProvider } from '../contexts/PackContext';
import ToasterClient from '../components/ToasterClient';
import AppFrame from '@/components/layout/AppFrame';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          <AuthProvider>
            <PackProvider>
              <ThemeProvider>
                <LayoutStateProvider>
                  <AppFrame>{children}</AppFrame>
                </LayoutStateProvider>
                <ToasterClient />
              </ThemeProvider>
            </PackProvider>
          </AuthProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
