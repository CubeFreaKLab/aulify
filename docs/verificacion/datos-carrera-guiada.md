# Respuesta y cierre concurrentes en una sesión guiada

El 28 de septiembre de 2026 se reprodujo y corrigió una carrera entre el envío de una respuesta y el cierre de la pregunta por el docente. Las pruebas utilizaron Supabase remoto, una materia ficticia y sesiones previamente autenticadas. No se enviaron correos ni se utilizaron cuentas estudiantiles reales.

Cada ejecución creó tres actividades de diez preguntas. En cada pregunta, cuatro estudiantes enviaron una respuesta mientras el docente solicitaba el cierre, con pequeñas variaciones de inicio. Fueron treinta rondas y ciento cincuenta operaciones concurrentes por ejecución.

| Resultado | Antes | Después |
|---|---:|---:|
| Respuestas aceptadas | 92 | 69 |
| Cierres aceptados en el primer intento | 11 | 30 |
| Error de restricción única en respuesta | 15 | 0 |
| Error de restricción única en cierre | 19 | 0 |
| Respuesta rechazada porque pregunta o intento ya estaban cerrados | 13 | 51 |

Las respuestas rechazadas por un cierre ya efectivo constituyen un resultado válido de esta carrera: el orden de llegada determina si se registra la respuesta o una omisión. Los errores `23505` eran fallos técnicos inesperados. La ejecución anterior recuperó los cierres fallidos antes de avanzar a la siguiente pregunta; esa recuperación no se contabilizó como éxito del primer intento.

La causa estaba en comprobar que la pregunta seguía abierta sin bloquear esa fila. Mientras la respuesta calculaba su nota, el cierre podía registrar una omisión para la misma pregunta e intentar crear la misma revisión de calificación. La migración `aulify_guided_answer_close_lock` adquiere un bloqueo compartido sobre la pregunta guiada antes de bloquear el intento. El cierre toma un bloqueo exclusivo de la pregunta y después opera sobre los intentos, conservando un orden compatible. Una respuesta ya confirmada sigue admitiendo un reintento idempotente después del cierre.

Después de aplicar la corrección, no hubo errores de restricción ni interbloqueos en las treinta rondas repetidas. La consulta posterior encontró doce intentos cerrados, ciento veinte preguntas de intento y sesenta y nueve respuestas persistidas. Había exactamente ciento veinte filas de calificación: sesenta y nueve automáticas y cincuenta y una omisiones. Coinciden con las respuestas aceptadas y los cierres que ganaron la carrera.

Se conservan los registros [anterior](datos-carrera-guiada-before-fix.json) y [posterior](datos-carrera-guiada-after-fix.json). El ejecutor es [guided-race.mjs](../../tools/datos/guided-race.mjs); utiliza credenciales y cookies locales excluidas de Git. Las comprobaciones aisladas adicionales verifican el reintento tras cierre y el rechazo de una respuesta nueva posterior al cierre.

Esta prueba comprueba la regla de concurrencia descrita; no sustituye el escenario de carga Q-06 ni garantiza ausencia de cualquier carrera posible.

## Repetición con contadores de sincronización

Tras incorporar las migraciones de lectura acotada y privacidad se repitieron treinta rondas, ciento cincuenta operaciones y tres actividades nuevas. No se observaron errores técnicos ni interbloqueos; los rechazos de respuesta posteriores al cierre siguieron siendo resultados permitidos. El [registro adicional](datos-carrera-guiada-revision-counters.json) conserva cada resultado. Esta repetición valida la compatibilidad del orden de bloqueos con los disparadores diferidos, sin acreditar el umbral de latencia bajo 204 sesiones.
