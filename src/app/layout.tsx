import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import { ThemeProvider } from '@/components/theme';
import { themeInit } from '@/lib/theme-init';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Aulify · Una clase, muchas formas de participar', template: '%s · Aulify' },
  description:
    'Crea recursos de clase, comparte actividades interactivas y acompaña a tus estudiantes de secundaria.',
  icons: { icon: '/brand/aulify-symbol.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
