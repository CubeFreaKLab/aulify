export default function Loading() {
  return (
    <main id="contenido" className="loading-shell" aria-busy="true" aria-label="Cargando Aulify">
      <div className="skeleton" style={{ width: '35%', height: 40 }} />
      <div className="skeleton" style={{ width: '65%' }} />
      <div className="skeleton block" />
    </main>
  );
}
