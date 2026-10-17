# Consulta del historial del aula

Fecha de comprobación: 17 de octubre de 2026.

La preparación del ensayo de capacidad se interrumpió al consultar las notas publicadas: ocho lecturas simultáneas de `/api/workspace` devolvieron HTTP 503. El informe `datos-carga-20261017184139.json` conserva ese resultado; no llegó a comenzar la medición formal.

El resumen reconstruía los intentos y las evaluaciones mediante una función por registro. La migración `20261017190116_aulify_set_based_workspace_history.sql` agrupa sus preguntas, respuestas y revisiones, y calcula los estados de resultados por conjuntos. Conserva el historial completo, las revisiones utilizadas en cada publicación y la autorización actual. Las agregaciones nuevas son privadas y no añaden una entrada pública.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Comparación con el contrato anterior | 36 comprobaciones aprobadas: ambos perfiles, revisión pendiente, publicación, corrección privada posterior, retroalimentación, plazos, retiro y archivo | `historial-conjuntos-local.json` |
| Reglas principales de la base | 85 comprobaciones aprobadas con 32 migraciones | `node tools/datos/check.mjs` |
| Ocho historiales estudiantiles simultáneos en la Preview | Ocho HTTP 200, con notas publicadas; entre 3,91 y 4,23 segundos por consulta | `historial-preview-20261017.json` |

La consulta puntual permite continuar el ensayo que se había interrumpido. No acredita por sí sola la capacidad para 200 estudiantes ni sustituye los tiempos de confirmación y propagación del protocolo Q-06. Los tiempos aislados de SQL dependen del estado del servidor y no se presentan como una mejora porcentual controlada.

## Ajuste del plan de consulta

El calentamiento posterior a la migración 32 confirmó y conservó las 2.000 respuestas, con p95 de 346,9 ms y cero fallos en 61.785 solicitudes. Sin embargo, las ocho lecturas de notas volvieron a agotarse; `datos-carga-20261017190434.json` conserva el fallo completo. No se presenta aquel calentamiento como una medición aprobada.

La migración `20261017192653_aulify_workspace_parameter_plans.sql` permite que el resumen y sus agregaciones adapten los planes a los parámetros de cada cuenta. Las agregaciones mantienen el contrato y sus permisos privados. La comparación de 36 casos y las 85 comprobaciones principales volvieron a aprobarse con las 33 migraciones.

Una comprobación independiente consultó los 200 historiales estudiantiles, con ocho lectores simultáneos, y encontró las 200 notas de la actividad publicada: cero errores y p95 de 1,15 segundos. La evidencia es `historial-estudiantes-200-20261017.json`. No sustituye el calentamiento ni los quince minutos de cada modalidad.

También se conserva una limitación: cuatro aperturas simultáneas del historial general docente, con los numerosos intentos ficticios acumulados, agotaron el tiempo de PostgreSQL. La lectura general debe paginarse antes de afirmar que ese historial admite cualquier volumen. Los resultados de `historial-parametros-preview-20261017.json` y `historial-parametros-lectura-200-20261017.json` no se ocultan ni se atribuyen a la consulta estudiantil anterior.
