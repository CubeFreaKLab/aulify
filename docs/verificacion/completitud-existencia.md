# Comprobar revisión pendiente mediante existencia de calificaciones

La migración `20260930051014_aulify_completion_grade_existence.sql` simplifica el helper interno `app.attempt_complete`. Una calificación siempre tiene `points_num NOT NULL`; para saber si una pregunta espera corrección basta comprobar si existe una calificación. No es necesario ordenar y recuperar la última revisión ni unir otra vez las preguntas, cuya existencia garantiza la clave foránea. Se conservan las condiciones de cierre, exclusión y resolución docente, así como la comprobación de que el intento pertenece a un quiz.

La optimización no calcula otra nota, elimina historial ni publica revisiones privadas. Tampoco añade funciones públicas: el helper sigue sin permiso de ejecución para `anon` y `authenticated`, con `SECURITY DEFINER` y `search_path` vacío. Sólo lo utilizan operaciones internas ya autorizadas.

## Verificación

- [32 comprobaciones aisladas](datos-completitud-existencia-local.json) contrastaron el resumen, los estados de intentos y los permisos con el contrato previo. Incluyen escritura pendiente, correcciones sucesivas, publicación, exclusión, archivo, retiro y ausencia de identidad.
- La regresión general de PostgreSQL aislado aprobó 85 comprobaciones con las veintitrés migraciones. Fue una ejecución local de `node tools/datos/check.mjs`, posterior a la nueva función; no se atribuye ese resultado a CI.
- [Cien intentos remotos](datos-completitud-existencia-remota.json) conservaron su valor de completitud antes y después. Los cien coincidieron también con `app.attempt_score`, que calcula la puntuación completa.
- [Dos pasadas HTTP de 24 cuentas, antes y después](datos-completitud-existencia-http.json), con concurrencia ocho, finalizaron sin errores. Se conservaron el tamaño de las respuestas y el número de intentos por cuenta. La segunda pasada pasó de p95 879,08 ms a 756,01 ms. Son muestras acotadas con posibles efectos de caché y variación del servicio; no demuestran por sí solas una mejora general ni aprueban capacidad.

El asesor del proveedor conserva avisos informativos de tablas con RLS sin política directa e índices aún no utilizados, y la advertencia de protección de contraseñas filtradas desactivada. Las tablas privadas no reciben permisos generales por estos avisos; tampoco se eliminan índices por no haber sido usados en esta muestra. Referencias de revisión: [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [índices no utilizados](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) y [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Esta corrección reduce trabajo en la consulta de resultados. No modifica el envío de respuestas ni resuelve por sí sola los tiempos del [ensayo sostenido anterior](carga-individual-20260930.md). Q-06 y Q-09 continúan abiertos; todavía debe localizarse el costo durante las ráfagas antes de repetir el protocolo completo.
