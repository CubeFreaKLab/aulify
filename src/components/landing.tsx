import Image from 'next/image';
import Link from 'next/link';
import { ThemeSwitcher } from './theme';

export function Landing() {
  return (
    <div className="home-minimal">
      <header className="home-toolbar">
        <h1>
          <Image src="/brand/aulify-logo.svg" alt="Aulify" width={148} height={49} priority />
        </h1>
        <nav className="home-actions" aria-label="Acceso a Aulify">
          <Link className="button" href="/acceso">
            Entrar
          </Link>
          <Link className="button secondary" href="/registro">
            Registrarse
          </Link>
        </nav>
        <ThemeSwitcher compact />
      </header>
      <main id="contenido" className="home-entry" aria-label="Inicio" />
      <footer>
        <nav className="home-demos" aria-label="Demostración sin cuenta">
          <Link href="/demo?perfil=docente">Demo docente</Link>
          <Link href="/demo?perfil=estudiante">Demo estudiante</Link>
        </nav>
      </footer>
    </div>
  );
}
