import './globals.css';

export const metadata = {
  title: 'Kiff Sandbox Lite',
  description: 'Lightweight chat + preview workbench',
};

import { ThemeProvider } from '../components/theme/ThemeProvider';
import { LayoutStateProvider } from '../components/layout/LayoutState';
import { AuthProvider } from '../contexts/AuthContext';
import ToasterClient from '../components/ToasterClient';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LayoutStateProvider>
              {children}
            </LayoutStateProvider>
            <ToasterClient />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
