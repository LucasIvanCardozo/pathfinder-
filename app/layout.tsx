import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import './globals.module.css';
import { DisableContextMenu } from '@/components/DisableContextMenu';
import { NoFocusOnClick } from '@/components/NoFocusOnClick';

export const metadata: Metadata = {
  title: 'Pathfinder — Battle Map',
  description:
    'Editor de mapas para Pathfinder. Arma escenarios con grilla, tiles y piezas personalizadas.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <DisableContextMenu />
        <NoFocusOnClick />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#1c1f23',
              color: '#f1f1f1',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            },
          }}
        />
      </body>
    </html>
  );
}
