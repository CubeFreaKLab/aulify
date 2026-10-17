# Diagnóstico previo a los avisos de actividad

Estos ensayos utilizaron sondeo de un segundo por sesión. Ninguno alcanzó las dos mediciones formales completas. Se conservan los intentos fallidos; sus cifras no se trasladan a la revisión con SSE.

| Registro | Cierre | Duración de calentamiento (s) | Confirmación p95 (ms) | Fallos | Respuestas confirmadas |
|---|---|---:|---:|---:|---:|
| [datos-carga-20261017182346.json](datos-carga-20261017182346.json) | stopped-at-safety-limit | 300.313 | 11262.36 | 233 | 2000 |
| [datos-carga-20261017184139.json](datos-carga-20261017184139.json) | failed | 300.39 | 1895.28 | 0 | 2000 |
| [datos-carga-20261017190434.json](datos-carga-20261017190434.json) | failed | 301.594 | 346.9 | 0 | 2000 |
| [datos-carga-20261017193227.json](datos-carga-20261017193227.json) | stopped-at-safety-limit | 99.034 | 89772.31 | 659 | 155 |
| [datos-carga-20261017193750.json](datos-carga-20261017193750.json) | failed | 300.344 | 1439.52 | 0 | 2000 |
| [datos-carga-20261017195905.json](datos-carga-20261017195905.json) | stopped-at-safety-limit | 332.154 | 474.23 | 761 | 1639 |
| [datos-carga-20261017201005.json](datos-carga-20261017201005.json) | stopped-at-safety-limit | 331.901 | 5659.72 | 742 | 1653 |

## Hallazgo y corrección

Las lecturas repetidas mantuvieron tráfico aun cuando el estado no cambiaba. Algunas ejecuciones funcionaron varios minutos y después acumularon tiempos de espera. La [observación nativa](observador-capacidad-20261017.json) tomó 133 muestras: no encontró procesos bloqueados por otras transacciones ni incrementos de lecturas de disco, archivos temporales o interbloqueos durante esa ventana. Esto no demuestra una causa única ni permite atribuir el problema a créditos de CPU.

La [consulta del historial por conjuntos](historial-conjuntos-20261017.md) permitió leer las 200 notas de estudiantes en una verificación puntual. Las lecturas simultáneas del historial docente completo conservan una limitación documentada; no se presentan como resueltas por ese resultado.

La revisión posterior reduce el trabajo sin cambios: el servidor recibe avisos privados y los distribuye mediante SSE. El estudiante mantiene comprobaciones de respaldo y vuelve al sondeo cuando pierde el canal. Los mensajes de una operación guiada común no se multiplican por participante. El [ADR 0005](../decisiones/0005-avisos-de-actividad.md) conserva la decisión.

La [comprobación SQL](avisos-actividad-sql-20261017.json) cubre permisos, ausencia de datos de respuesta en los mensajes, reversión transaccional, retiro y conservación del comando si Realtime no está disponible. El [recorrido de Preview](avisos-actividad-preview-20261017.json) comprueba conexión y revocación reales. Su primer intento se conserva [por separado](avisos-actividad-preview-20261017-preliminar.json): usó por error el identificador de solicitud al retirar una matrícula y recibió el rechazo previsto del sistema; se corrigió el ejecutor.

La medición completa de la nueva revisión se documentará por separado. Se mantienen las duraciones, doscientos participantes, ráfaga, integridad y umbrales originales.
