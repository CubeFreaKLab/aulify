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
