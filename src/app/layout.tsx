import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Aulify · Una clase, muchas formas de participar', template: '%s · Aulify' },
  description:
    'Crea recursos de clase, comparte actividades interactivas y acompaña a tus estudiantes de secundaria.',
  icons: { icon: '/brand/aulify-symbol.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
