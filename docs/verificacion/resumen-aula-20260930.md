# Resumen del aula sin reconstruir todos los quizzes

La consulta de resultados del diagnóstico anterior falló al reconstruir preguntas históricas y al calcular la puntuación de intentos para saber si faltaba revisión. La migración `20260930040716_aulify_workspace_overview.sql` separa esas necesidades.

La interfaz general utiliza `aulify_workspace_overview`: conserva materias, intentos, evaluaciones, recursos de lectura y resultados autorizados. Incluye el número de preguntas de cada quiz. El contenido completo del quiz se consulta al abrirlo mediante el endpoint de actividad, que mantiene su contrato. El snapshot completo anterior sigue disponible para compatibilidad. Detectar revisiones pendientes comprueba las correcciones existentes y el cierre administrativo, sin sumar fracciones de puntuación; publicar o mostrar una nota mantiene sus cálculos originales.

## Comprobaciones

- [Comparación local](datos-resumen-aula-local.json): 32 comprobaciones sobre las 22 migraciones. Incluye múltiples intentos, escritura pendiente, publicación, revisión privada posterior, retiro, archivo, purga, aislamiento entre docentes y permisos anónimos. Compara estados de cierre y resolución con la función de puntuación anterior.
- [Comparación remota](datos-resumen-aula-remoto.json): una cuenta ficticia con 22 actividades y 22 intentos conserva los demás campos del snapshot. Su representación JSON pasa de 366.575 a 104.951 bytes. Cien intentos remotos mantienen el mismo indicador de completitud. El helper nuevo no es ejecutable por clientes y el resumen rechaza al rol anónimo.
- [Regresión HTTP](datos-resumen-aula-http.json): las 200 cuentas estudiantiles existentes consultaron resultados con concurrencia ocho. Las 200 respuestas fueron correctas, sin errores, con p95 de 755,40 ms y máximo de 2.959,78 ms. Todas mantuvieron una calificación publicada de 100 y los conteos de preguntas. Se recibieron 11.188.647 bytes de cuerpos JSON. Servidor Next.js compilado local, Supabase remoto.
- 41 pruebas unitarias de sincronización y errores RPC aprobadas. Compilación y comprobación de tipos aprobadas. El control local del resumen queda incorporado a GitHub Actions.
- [Recorrido en Chromium](datos-resumen-aula-navegador.json): cinco comprobaciones con las sesiones reales de un docente y un estudiante ficticios. Las materias presentan sus conteos, ambos abren una actividad y el estudiante consulta sus resultados al salir. Captura revisada visualmente.

## Alcance

Esta regresión reproduce la consulta que había fallado después de publicar notas. No mide las fases de cinco y quince minutos, la actividad guiada ni el despliegue público. Q-06 y Q-09 continúan pendientes; no se cambiaron sus umbrales. El historial no se eliminó para reducir la carga.

El asesor conserva los avisos ya existentes de tablas privadas con RLS sin políticas directas y protección de contraseñas filtradas desactivada. Las tablas se acceden mediante funciones autorizadas; el asesor no sustituye las pruebas de permisos. Referencias: [RLS sin política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) y [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
