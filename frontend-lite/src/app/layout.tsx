import './globals.css';

export const metadata = {
  title: 'Kiff Sandbox Lite',
  description: 'Lightweight chat + preview workbench',
};

import { ThemeProvider } from '../components/theme/ThemeProvider';
import { LayoutStateProvider } from '../components/layout/LayoutState';
import { NextAuthProvider } from '../contexts/NextAuthProvider';
import { AuthProvider } from '../contexts/AuthContext';
import ToasterClient from '../components/ToasterClient';
import AppFrame from '@/components/layout/AppFrame';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          <AuthProvider>
            <ThemeProvider>
              <LayoutStateProvider>
                <AppFrame>{children}</AppFrame>
              </LayoutStateProvider>
              <ToasterClient />
            </ThemeProvider>
          </AuthProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
