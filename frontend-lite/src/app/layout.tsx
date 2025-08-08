import './globals.css';

export const metadata = {
  title: 'Kiff Sandbox Lite',
  description: 'Lightweight chat + preview workbench',
};

import { ThemeProvider } from '../components/theme/ThemeProvider';
import { LayoutStateProvider } from '../components/layout/LayoutState';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <LayoutStateProvider>
            {children}
          </LayoutStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
