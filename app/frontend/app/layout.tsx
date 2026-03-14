import type { Metadata } from 'next';
import './globals.css';
import FaviconUpdater from '../components/FaviconUpdater';

export const metadata: Metadata = {
  title: 'Bhima Finance',
  description: 'Internal Finance Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <FaviconUpdater />
        {children}
      </body>
    </html>
  );
}
