# Acumulación de solicitudes hacia Supabase

La observación del pool de 64 conexiones encontró esperas en la aplicación. Un diagnóstico de un minuto confirmó y conservó 200 respuestas, con p95 de 695,93 ms y sin errores. Sin embargo, al intentar cinco minutos con diez preguntas se acumuló trabajo: el corte preventivo detuvo el ensayo a los 128 segundos. Se registraron 904 fallos de 12.414 solicitudes; no se completaron los cinco minutos ni una medición de capacidad.

La auditoría encontró 600 respuestas persistidas. Las 486 confirmadas al cliente estaban presentes, sin cambios ni duplicados. Las otras 114 no recibieron confirmación a tiempo: un fallo de transporte no demuestra que una escritura no se haya realizado. La aplicación debe conservar las claves de idempotencia y reconciliar su estado, sin reenviar creaciones indiscriminadamente.

El [resumen del diagnóstico](cola-transporte-20260930.json) conserva las huellas de los registros y sus ventanas. Durante el ensayo prolongado se observaron hasta 676 solicitudes en cola. El [resultado del ejecutor](datos-carga-20260930053101.json) identifica el corte y la auditoría. No hubo cambios de aplicación ni esquema durante la medición. La instrumentación privada sondeó estadísticas cada 100 ms y puede introducir sobrecarga; esta observación no aísla por sí sola todos los costos de red y base de datos.

## Corrección a comprobar

El transporte aumenta a **128 conexiones HTTP/1.1 por origen e instancia** y fija un plazo de **12 segundos por solicitud al servicio**. Conserva una operación por conexión y no añade reenvíos. El plazo está por debajo de los quince segundos de espera del cliente del aula y combina cualquier cancelación ya suministrada por el llamador. La espera incluye cola y transporte. No cambia los plazos de las actividades ni garantiza que una transacción ya confirmada pueda revertirse.

Un servidor HTTP de prueba comprobó que un comando cancelado mientras esperaba no se envía después de liberar la conexión. Otra prueba acotó un POST lento sin repetirlo. Con el SDK real y transporte simulado, el plazo agotado conserva la respuesta 503, la indicación de escritura sin confirmar y `Retry-After`. El conjunto local aprobó 154 pruebas en diecisiete archivos. El tamaño del pool requiere una nueva medición: no se presenta como capacidad ya aprobada.

Q-06 y Q-09 siguen abiertos. Se mantienen los umbrales, el historial y los límites preventivos del ejecutor. El diagnóstico de sesenta segundos no sustituye las dos modalidades completas.
