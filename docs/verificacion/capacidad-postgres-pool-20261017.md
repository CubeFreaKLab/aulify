# Capacidad con PostgreSQL y pools de servidor

Estado: ensayo detenido por seguridad. La capacidad de cuatro docentes y doscientos estudiantes todavía no está aprobada. No hay una carga activa.

## Qué se corrigió

La aplicación conserva las mismas operaciones y permisos. El servidor puede ejecutarlas mediante una conexión PostgreSQL verificada, evitando el transporte REST para esas operaciones. Auth, Storage y los avisos de actividad mantienen sus servicios de Supabase.

El primer intento alcanzó el límite de clientes del pooler. Se incorporó el mecanismo oficial de Vercel que permite cerrar las conexiones inactivas antes de suspender una instancia. El siguiente intento terminó el calentamiento, pero tuvo demoras al enviar respuestas. Se ampliaron los pools a cuatro conexiones para lecturas y ocho para comandos por proceso. El registro de diagnóstico distingue espera de conexión y ejecución sin guardar consultas, credenciales ni contenido de estudiantes.

## Comprobaciones previas

| Comprobación | Resultado | Alcance |
|---|---|---|
| Primer ensayo nativo | Se cortó al alcanzar el límite de clientes del pooler. | Fallido; se conserva la evidencia. |
| Ensayo con pools de dos conexiones y limpieza de Vercel | Calentamiento completo con 2.000 respuestas conservadas. La primera ronda de la medición tuvo 122 confirmaciones por encima de 1,5 segundos. | Se detuvo: ya no podía cumplir el percentil de las 2.000 respuestas previstas. |
| Pool ampliado: 200 envíos en 23 ms | 200 confirmados, sin fallos; p95 de 3,07 segundos. | Diagnóstico más brusco que la ventana del protocolo. No aprueba capacidad. |
| Pool ampliado: ventana original de hasta dos segundos | 200 confirmados, sin fallos; p95 de 1,28 segundos. Los 200 avisos SSE permanecieron conectados. | Comprobación corta que justifica iniciar el ensayo completo. No lo sustituye. |

La segunda comprobación corta usa lecturas docentes de revisión y descarga el estado cuando cambia, igual que el cliente. El diagnóstico anterior descargaba el estado docente cada segundo. Se conservan ambos resultados porque sus cargas son diferentes. El ejecutor original ya distribuía la ráfaga en 1,9 segundos y no se modificó para este ensayo.

## Medición completa

La revisión evaluada fue `c34d927742e0b721ee2f9862bb586828065a83bc`, build `lVEkPO6FqwMSXW-k3cQDU`, en Preview protegida de Vercel y Supabase Free, con treinta y cinco migraciones.

Cada modalidad incluye cinco minutos de calentamiento y quince de medición. Los cuatro docentes y doscientos estudiantes utilizan cuentas ficticias existentes. La preparación y renovación de sesiones quedan fuera de la medición. El generador reproduce el protocolo HTTP; no ejecuta doscientos navegadores ni mide el dibujo de sus pantallas.

Se mantienen todos los criterios: confirmación p95 de hasta 1,5 segundos; propagación guiada p95 de hasta dos segundos; menos del 1 % de fallos técnicos; 2.000 respuestas confirmadas y conservadas por fase, sin duplicados; consulta correcta de las 200 notas; ráfaga de 200 envíos en hasta dos segundos; consumo dentro de los planes gratuitos. El presupuesto preventivo de transferencia adicional es de 1,6 GB.

El calentamiento terminó con las 2.000 respuestas conservadas y las 200 notas consultadas. La medición individual se cortó a los 61,397 segundos: 94 fallos entre 962 solicitudes y p95 de confirmación de 36,76 segundos. Las 200 respuestas confirmadas estaban persistidas, sin pérdidas ni duplicados. No se ejecutó la modalidad guiada ni se acreditó el consumo del escenario completo. Véase el [informe del ensayo](capacidad-pool-ampliado-inicial-20261017.md).

## Corrección posterior, todavía sin medición de capacidad

La carga inicial de la actividad no conservaba la revisión que representaba su estado. Al empezar el sondeo, se descargaba de nuevo la proyección de cada estudiante. Se añadió un testigo de revisión: el servidor lo entrega solo si la revisión coincide antes y después de leer el estado. Si hubo un cambio durante la lectura, no se entrega ese testigo.

El cliente reutiliza únicamente la proyección comprobada de la misma actividad. Sigue verificando acceso y plazos; un cambio externo o una recuperación tras error exige volver a leer. El generador adopta el mismo comportamiento, sin modificar cantidades, ventanas ni umbrales. La migración `20261017224614_aulify_projection_sync_seed.sql` está aplicada; ahora hay treinta y seis migraciones y las mismas tablas y permisos.

Pasaron 23 pruebas de sincronización del cliente y 17 comprobaciones SQL aisladas, incluidas identidad propia, ausencia de acceso anónimo y cambio simulado durante una lectura. Una comprobación HTTP remota confirmó el nuevo metadato y los rechazos de acceso. Estos resultados **no acreditan capacidad**: falta compilar la nueva versión del cliente y comprobarla bajo carga.

El acceso temporal fue [revocado y comprobado](acceso-native-capacidad-revocado-20261017.json). No se contrataron planes ni se liberó producción.

## Evidencia

- [Corte del ensayo anterior y auditoría posterior](corte-rafaga-postgres-20261017.json). El archivo original de esa ejecución conserva su último checkpoint y no representa una prueba completada.
- [Diagnóstico de envíos concentrados](rafaga-pool-ampliado-20261017.json).
- [Diagnóstico con la ventana original](rafaga-protocolo-original-20261017.json).
- [CI de la revisión evaluada](ci-pool-ampliado-20261017.json).
- [Decisión de transporte](../decisiones/0006-transporte-postgresql.md).

Los diagnósticos y el CI no sustituyen la aprobación de Q-06, AP-35 o Q-09.
