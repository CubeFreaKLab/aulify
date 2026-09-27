import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="contenido" className="error-page">
      <h1>Esta página no está aquí.</h1>
      <p>Vuelve a Aulify para encontrar tu siguiente clase.</p>
      <Link className="button" href="/">
        Volver al inicio
      </Link>
    </main>
  );
}
