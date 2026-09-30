# Conservación de archivos compartidos y reintento de purga

29 de septiembre de 2026. Ensayo focalizado de AP-31 y AP-32. Se distingue la ejecución aislada con bytes locales de la operación remota: hasta este corte remoto solo se inspeccionaron definiciones y candidatos, sin ejecutar mantenimiento ni eliminar objetos.

## Resultado aislado

El [script reproducible](../../tools/datos/retention-shared-files-check.mjs) crea una base PostgreSQL nueva en PGlite, aplica las migraciones disponibles y escribe tres PNG de 68 bytes en un directorio local identificado por un prefijo aleatorio de la ejecución. No lee credenciales ni abre conexiones a Supabase. El [registro](conservacion-archivos-compartidos.json) contiene 32 comprobaciones aprobadas; los ensayos repetidos durante la preparación no se suman como cobertura adicional.

El primer recorrido comprueba una topología histórica concreta: el mismo archivo está referenciado desde borrador, versión publicada y entrega de una materia vencida. Se elimina únicamente la referencia de la materia; el archivo compartido, el borrador, la versión y la autorización de biblioteca permanecen. Otros dos archivos exclusivos de la entrega aparecen en la cola de eliminación. Se comparan los bytes y sus hashes antes y después.

Esa referencia compartida biblioteca/entrega se prepara expresamente por SQL en la base aislada. El contrato público requiere que la imagen de biblioteca pertenezca al docente y que los adjuntos de entrega pertenezcan al estudiante; la prueba comprueba el rechazo `INVALID_FILES` al intentar entregar el archivo de otra cuenta. No se presenta la preparación SQL como una acción disponible para el usuario ni se relajan esas restricciones.

El segundo recorrido utiliza comandos públicos: crea una materia nueva y publica como lectura la versión de biblioteca que contiene la imagen. Después de simular exclusivamente el vencimiento de esa materia, se elimina su actividad de lectura y se conserva la versión, el objeto y el acceso docente por biblioteca. Este recorrido no añade una referencia SQL artificial de entrega.

## Fallo parcial e idempotencia

Después de que la purga quite las relaciones de la primera materia, el adaptador local elimina los bytes y la fila de Storage de solo uno de los dos objetos exclusivos. La confirmación de ambos falla con `STORAGE_OBJECT_REMAINS` mientras el segundo existe. La transacción conserva los dos metadatos pendientes y el trabajo sigue en ejecución.

El siguiente `tick` entrega exactamente los mismos dos identificadores. El adaptador tolera que el primer archivo ya no exista y elimina el segundo. La confirmación elimina dos metadatos; repetirla elimina cero y el siguiente `tick` devuelve una cola vacía. Los dos recorridos terminan su trabajo de purga. La materia de control, las cuentas y los documentos de biblioteca se comparan íntegramente; el único archivo restante en el directorio es la imagen compartida con su hash original.

Los bytes son archivos locales reales, pero `storage.objects` pertenece al esquema simulado de PGlite. Esto no equivale a comprobar la API de Storage, su servicio de objetos ni una caída remota. El fallo se introduce de forma deliberada entre eliminación y confirmación.

## Inspección remota y alcance de la operación

Se leyó la definición efectiva de `app.maintenance` en Supabase. `tick` no admite filtro por materia o ejecución: puede cerrar hasta 500 intentos vencidos, eliminar señales antiguas, purgar hasta diez materias, marcar huérfanos de más de un día y devolver hasta cien archivos de toda la cola. `confirmFiles` filtra los identificadores de archivo, pero también finaliza globalmente trabajos en ejecución sin referencias pendientes. El [consumidor vigente](../../tools/datos/maintenance.mjs) procesa esa cola global.

El [inventario reproducible de efectos](../../tools/datos/retention-effects-inventory.sql), ejecutado remotamente a las **23:55:50 UTC del 29 de septiembre**, obtuvo:

| Efecto global elegible antes de crear un nuevo fixture | Cantidad |
|---|---:|
| Intentos abiertos vencidos | 0 |
| Señales de integridad vencidas | 0 |
| Materias con purga exigible | 0 |
| Archivos huérfanos por marcar | 0 |
| Objetos `delete_pending` | 0 |
| Trabajos en ejecución que podrían completarse | 0 |

No había candidatos ajenos en ese instante. El resultado no garantiza que una llamada posterior siga aislada: las fechas o escrituras concurrentes pueden cambiar los candidatos. No existe una operación de purga completa por identificador en el contrato revisado. Garantizar el aislamiento de ese ensayo exigiría una operación acotada adicional o un entorno remoto separado; no se implementó ninguno en esta unidad. No se crearon fixtures remotos ni se ejecutó `tick`. Tampoco se bloquearon escrituras globales ni se eliminaron objetos remotos.

## Reproducción y límites

```powershell
node tools/datos/retention-shared-files-check.mjs
```

El JSON registra prefijo, fechas, migraciones y SHA-256 del script. El ensayo crea únicamente sus archivos propios dentro de `.local-private`; conserva la imagen restante para inspección y nunca borra recursivamente directorios. No modifica datos preexistentes, esquema ni duración de conservación.

La primera ejecución añadida a CI (`36649762066`) se detuvo antes del ensayo porque un checkout limpio no contenía el directorio privado padre. Se corrigió su creación previa, conservando la creación exclusiva de la carpeta de cada ejecución. El fallo no corresponde a una eliminación de archivos ni a un resultado de la base de datos. La repetición `36649932369`, sobre `6665f2f`, aprobó ese paso y el resto de CI según la API de GitHub; sus registros están en [ci-integracion.json](ci-integracion.json).

Esta evidencia amplía AP-31 con fallo parcial y reintento aislados y AP-32 con conservación explícita de un objeto compartido. La [verificación posterior de restauración y purga](carrera-restauracion-purga.md) utiliza cuatro conexiones PostgreSQL nativas y demuestra cinco intercalados controlados, con 28 comprobaciones aprobadas. Permanecen sin demostrar la operación remota de estos casos y el objetivo operativo de eliminación dentro de 24 horas. La simulación de 31 días no es una medición de ese plazo real.
