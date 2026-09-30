# Restauración y purga concurrentes

30 de septiembre de 2026. Ensayo aislado de la exclusión exigida por IN-06 y del límite de restauración de AP-31. Complementa la [conservación de archivos compartidos](conservacion-archivos-compartidos.md), sin sustituir sus pruebas de fallo parcial ni atribuir evidencia remota.

**Resultado:** no se demostró una carrera que permita eliminar una materia después de confirmar válidamente su restauración. El [ejecutor](../../tools/datos/retention-race-check.mjs) aprobó **28 comprobaciones** en PostgreSQL **17.6 nativo**, con cuatro procesos de conexión independientes y las dieciocho migraciones confirmadas hasta `20260930000631`. El [JSON](carrera-restauracion-purga.json) registra resultados, fechas y hashes. No se cambió el SQL ni se preparó una migración.

## Exclusión observada

`restoreSubject` obtiene `FOR UPDATE` sobre la materia antes de comprobar propietario, archivo, plazo y comienzo de purga. La restauración y la cancelación del trabajo pendiente se confirman en la misma transacción. `tick` selecciona trabajos vencidos con `FOR UPDATE OF pj,s SKIP LOCKED`, por lo que también debe obtener el bloqueo de esa materia antes de marcarla y eliminarla.

| Intercalado ejecutado                                                                                                                    | Observación y estado final                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Restauración obtiene el bloqueo antes del límite; permanece sin confirmar mientras transcurren los 30 días; otro proceso ejecuta `tick`. | El mantenimiento omite esa materia. Tras confirmar restauración y repetir `tick`, la materia sigue activa y el trabajo está cancelado.                                                   |
| Purga obtiene el bloqueo de una materia vencida y elimina dentro de su transacción; otra conexión intenta restaurar.                     | Se observa `wait_event_type = Lock` y `pg_blocking_pids` identifica al proceso de purga. Tras su `COMMIT`, la restauración rechaza `RESTORE_UNAVAILABLE`.                                |
| Restauración mantiene el bloqueo al cruzar el límite, pero termina con `ROLLBACK`.                                                       | El primer `tick` omite la fila; el siguiente encuentra nuevamente la materia archivada y la elimina. No queda una cancelación parcial del trabajo.                                       |
| Dos consumidores procesan el mismo candidato; el primero todavía no confirma y luego revierte.                                           | El segundo omite el candidato bloqueado. La reversión conserva materia y trabajo; un siguiente lote puede completarlo. Repetir el lote confirmado no produce nuevos objetos para borrar. |
| `archived_at + interval '30 days'` coincide exactamente con `now()` en una transacción controlada.                                       | La igualdad se comprueba en SQL y `restoreSubject` rechaza la restauración sin modificar la materia. No se aproxima el límite con una espera del cliente.                                |

Los resultados coinciden con la semántica documentada de PostgreSQL: un bloqueo de fila impide la modificación o eliminación concurrente y se mantiene hasta terminar la transacción; una lectura bloqueante posterior al borrado confirmado no recupera una fila antigua. [Bloqueos explícitos de PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html).

El corte temporal vigente usa `now()`, que corresponde al inicio de la transacción. El ensayo demuestra expresamente una restauración admitida antes del vencimiento cuyo `COMMIT` ocurre después, sin que la purga pueda competir con ella. No se sustituyó este criterio por el reloj de confirmación ni se modificaron los treinta días. [Funciones de fecha y hora de PostgreSQL](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

## Permisos y conservación

El contrato público rechaza restauraciones de otro docente y de un estudiante; el rol anónimo no puede invocar la operación. El rol autenticado tampoco puede ejecutar mantenimiento. Las operaciones de prueba se llaman mediante `public.aulify_command`, `public.aulify_maintenance` y `public.aulify_file`, con sus roles respectivos.

Una versión de biblioteca con imagen se publica como lectura en una materia de control y en otra que se purga. Después del intercalado de purga/restauración, se comparan íntegramente materia de control, perfiles, recurso, borrador, versión y metadatos de archivo. El objeto simulado de Storage permanece y el docente sigue obteniendo el archivo por el contrato autorizado de biblioteca. La imagen se siembra como carga ya validada; el recurso, publicación y lecturas se crean por comandos públicos. No se altera la propiedad del archivo ni se elimina biblioteca independiente.

Esta comprobación cubre una referencia autorizada que ya existía al comenzar la purga. No demuestra una carrera de creación de referencias nuevas mientras se elimina un archivo. El caso biblioteca/entrega y los bytes locales se verifican en el informe complementario, no se cuentan de nuevo aquí.

## Reproducción y alcance

```powershell
$env:AULIFY_POSTGRES_BIN='C:/Program Files/PostgreSQL/17/bin'
node tools/datos/retention-race-check.mjs
```

El ejecutor requiere binarios PostgreSQL ya instalados. Crea un clúster nuevo en un directorio privado exclusivo, elige un puerto disponible y escucha únicamente en `127.0.0.1`. Inicializa Auth y Storage de prueba, aplica el corte explícito de migraciones y abre cuatro conexiones. Al finalizar, cierra esas conexiones y detiene exclusivamente su propio clúster. Conserva sus archivos para inspección; no instala un servicio, no conecta con una base preexistente ni elimina directorios. La ejecución final terminó con el clúster detenido.

La preparación necesitó corregir tres problemas del ejecutor: handles heredados de `pg_ctl` en Windows, una columna inexistente usada solo para ordenar una aserción y la conversión del booleano textual de `psql` a JSON. Ninguno demostró un defecto de restauración/purga. Los clústeres de esas ejecuciones quedaron detenidos; la primera detención se realizó de forma explícita. No se suman sus comprobaciones parciales al resultado final.

PGlite no se utilizó como prueba de concurrencia: tiene una única conexión exclusiva, y el acceso desde varios clientes mediante un worker no convierte sus consultas serializadas en transacciones PostgreSQL independientes. [Documentación de PGlite](https://pglite.dev/docs/multi-tab-worker).

No se realizaron solicitudes a Supabase, ejecuciones de Storage remoto, pruebas de carga, compilaciones ni reinicios de Aulify. Siguen pendientes la operación remota del mantenimiento y la medición del objetivo de borrado activo dentro de 24 horas. Este ensayo prueba intercalados controlados; no constituye una demostración exhaustiva de todo posible conflicto de escritura o caída de infraestructura.
