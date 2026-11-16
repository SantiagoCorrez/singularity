import type { Metadata } from 'next';
// Fuentes autoalojadas: no dependen de la red al compilar ni al cargar la página.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Singularity · Neural Scan',
  description: 'Reporte de emociones de una canción, con procedencia en cada cifra.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
