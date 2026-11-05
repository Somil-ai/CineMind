import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = { title: 'CineMind: movie recommendations that explain themselves', description: 'Personalized movie picks with a reason for every one.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Hanken+Grotesk:wght@400;500;600&display=swap" />
      </head>
      <body className="font-sans antialiased"><Providers><Shell>{children}</Shell></Providers></body>
    </html>
  );
}
