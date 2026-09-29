# Revisión docente por participante

29 de septiembre de 2026. La migración `20260929224538_aulify_participant_teacher_revision.sql` elimina la escritura del contador común de actividad al registrar una respuesta o una corrección personal. **Está aplicada en Supabase y verificada con pruebas aisladas y una regresión remota acotada. Q-06 sigue pendiente.**

La CLI creó inicialmente el archivo con versión `20260929223641`. Al aplicarlo, el servicio asignó `20260929224538` y se alineó el nombre local. El SQL es idéntico, con SHA-256 `3575310698289b9543d02832e0634259f48e0edb120411be856880acf56b23a2`. Los registros históricos conservan el nombre utilizado al ejecutarse; el resultado aislado repetido y el remoto identifican el nombre definitivo. Existen dieciséis migraciones locales y remotas.

## Problema y cambio

Una respuesta automática generaba dos actualizaciones diferidas de `activity_sync_versions.teacher_revision`: una por la respuesta y otra por su corrección. Los cincuenta participantes de una actividad escribían la misma fila técnica, aunque sus respuestas fueran independientes. El [diagnóstico anterior](datos-diagnostico-serializacion.md) separó esta ruta del trabajo duplicado en snapshots.

El modelo 1.3 añade `teacher_revision` a `participant_sync_versions`. Cada respuesta y corrección personal actualiza la fila de su participante. Se mantiene `student_revision` separado, para que las correcciones privadas sigan sin invalidar la proyección estudiantil. La revisión común permanece para configuración, cambios públicos o eventos cuyo participante ya no existe.

La huella del docente combina la marca común con pares `[identidad, revisión]`, ordenados por identidad. Incluir ambos datos evita que sustituir participantes con el mismo contador produzca la misma entrada del hash; una suma de revisiones no bastaría. Solo el propietario calcula ese agregado, después de comprobar autorización. El estudiante conserva el mismo formato de huella y consulta su revisión propia.

No cambian las respuestas, el cálculo de notas, la proyección de contenido, las claves de idempotencia, los plazos ni los bloqueos de dominio entre respuesta y cierre guiado. El helper continúa sin permiso de ejecución para roles cliente; las tablas técnicas siguen sin lectura o escritura directa. Los índices existentes de participantes por actividad y la PK del contador cubren las uniones añadidas, sin crear otro índice redundante.

## Verificación ejecutada

| Prueba | Resultado | Alcance |
|---|---:|---|
| Caso específico de revisiones | 31 comprobaciones aprobadas | Quince migraciones previas, aplicación de la nueva migración en memoria y comparación antes/después. |
| Regresión del contrato | 84 comprobaciones aprobadas | Dieciséis migraciones, ocho tipos de pregunta, permisos, publicación, guiado, archivos, retiro y purga. |
| Regresión del juego | 103 comprobaciones aprobadas en nueve casos | Mezcla, guiado, consumo único, privacidad de corrección/clasificación, equipos y autorización. |
| Regresión remota de privacidad y sincronización | 33 comprobaciones aprobadas; 53 llamadas RPC | Cuatro cuentas ficticias existentes y un cliente anónimo; proyecciones, huellas, publicación y clasificación. |
| Modelo | Estructura y derivados coherentes | 47 tablas propias, Auth externo, 295 campos, 78 claves foráneas; DBML, diccionario y diagramas regenerados. |
| Concurrencia PostgreSQL de dos sesiones | No ejecutada | Docker Desktop Linux Engine no estaba disponible. |

La prueba específica conserva los snapshots completos de docente y estudiantes después de migrar, salvo el reloj de transporte. Conserva también las huellas estudiantiles; la huella docente cambia una vez al adoptar su nueva composición y permanece estable si no hay cambios.

Una respuesta automática sin cierre actualizó dos veces el contador docente de su participante y una vez el estudiantil. La identidad física de la fila común (`ctid`) y sus valores permanecieron iguales. La fila técnica del otro participante tampoco cambió. El caso de base, antes de migrar, sí escribió dos veces la fila común. Esta comprobación identifica la escritura eliminada; **no mide cuánto esperarían dos transacciones simultáneas**.

También se comprobaron:

- respuesta nueva: invalida al docente y a su autor, sin invalidar al otro estudiante;
- reenvío idempotente: mismo ACK, sin escritura adicional de contadores;
- corrección privada: cambia la huella docente y conserva huella/contenido estudiantiles;
- publicación: actualiza la nota autorizada y la huella de su destinatario;
- alta, borrado y reemplazo de participante: invalidación docente, fallback común tras borrar y distinción de identidades con contadores iguales;
- cambio público: conserva invalidación común para los estudiantes;
- accesos ajenos, anónimos, no aprobados y retirados: siguen rechazados.

El caso de reemplazo iguala administrativamente la marca común para aislar el efecto de incluir la identidad en el agregado. Ese ajuste ocurre solo en la base ficticia del test. El borrado y la escritura directa de metadatos son operaciones administrativas del escenario, no nuevas acciones disponibles en la aplicación.

La aplicación remota comprobó la columna no nula, RLS habilitado y acceso al helper limitado al rol interno. La regresión de 22:47:11 a 22:47:26 UTC conservó notas, clasificación y huellas estudiantiles durante una corrección privada. Al republicar, actualizó la nota individual y el promedio del equipo. El docente mantuvo acceso a la corrección reservada y las cuentas ajenas o anónimas fueron rechazadas. La materia ficticia se archivó al terminar; no se utilizaron datos de estudiantes reales. Esta regresión no mide la latencia bajo carga ni el bloqueo entre transacciones.

## Reproducir y revisar

```sh
node tools/datos/participant-sync-check.mjs --report docs/verificacion/datos-revision-participante-aislada-migracion16.json
node tools/datos/check.mjs --report docs/verificacion/datos-regresion-revision-participante.json
node tools/datos/game-acceptance.mjs --report docs/verificacion/juego-regresion-revision-participante.json
python tools/modelado/generar.py --check
```

La regresión remota requiere el entorno privado de las cuatro cuentas preparadas y una ventana sin carga:

```sh
node tools/datos/game-privacy-remote.mjs --run --migration 20260929224538_aulify_participant_teacher_revision.sql --report docs/verificacion/juego-privacidad-remota-migracion16.json
```

- [Migración](../../supabase/migrations/20260929224538_aulify_participant_teacher_revision.sql).
- [Caso específico con nombre definitivo](datos-revision-participante-aislada-migracion16.json) y [primera ejecución, conservada](datos-revision-participante-aislada.json).
- [Regresión del contrato](datos-regresion-revision-participante.json).
- [Regresión del juego](juego-regresion-revision-participante.json).
- [Regresión remota de privacidad y sincronización](juego-privacidad-remota-migracion16.json).
- [Modelo 1.3](../modelado/README.md).

Para cerrar capacidad siguen faltando una comprobación simultánea que confirme el comportamiento de bloqueos y la medición remota con el protocolo establecido. El sondeo anterior de 200 confirmaciones con p95 de 3.867,53 ms no se reemplaza por los resultados locales. No se redujeron usuarios, duración ni umbrales del requisito.

Cuando una llamada del helper necesita filas común y personal, conserva el orden común → participante. La ausencia de interbloqueos entre comandos completos requiere el ensayo concurrente: las pruebas secuenciales no la acreditan. El cambio tampoco elimina tiempos de red, colas de PostgREST ni cualquier otro costo del servicio compartido.
