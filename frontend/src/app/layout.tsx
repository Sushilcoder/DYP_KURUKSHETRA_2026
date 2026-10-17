import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Verified Course Material Studio',
  description: 'Generate branded teaching packs and independently verify every code snippet.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
