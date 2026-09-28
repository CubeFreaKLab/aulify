# Verificación integrada de datos

El 28 de septiembre de 2026, entre las 06:52:14 y las 06:52:36 UTC, se ejecutaron 45 comprobaciones contra el proyecto Supabase de Aulify con `@supabase/supabase-js` 2.117.2. Todas terminaron aprobadas. La [evidencia JSON](datos-remotos.json) conserva los resultados y las horas reales de esta ejecución.

Se utilizaron cuatro cuentas ficticias independientes: dos docentes y dos estudiantes. Cada cliente obtuvo su propia sesión mediante Auth. La creación administrativa confirmó estas cuentas de prueba sin enviar correos. La credencial de servicio se utilizó únicamente para preparar cuentas y reservar o registrar el archivo de prueba; las operaciones del producto se ejecutaron con la sesión del usuario correspondiente.

## Recorridos comprobados

- Creación de materia, solicitud por código y aprobación. Un docente ajeno no puede aprobar solicitudes. Cambiar `user_metadata.role` no modifica el rol persistente ni concede permisos docentes.
- Guardado y publicación de un recurso con ocho tipos de pregunta. Las proyecciones estudiantiles excluyen soluciones, guías de corrección, explicaciones ocultas y pistas sin consumir.
- Intento individual, orden de preguntas, respuesta definitiva, pista, bonificación única, corrección manual y publicación separada de la nota. Las notas de otro estudiante no aparecen en el snapshot.
- Sala guiada con dos participantes, equipos, avance docente, confirmación de respuestas pendientes, omisiones y cierre normal. La clasificación utiliza alias y no expone correos ni identificadores de otras cuentas.
- Tarea con carga directa mediante URL firmada a un bucket privado. Los bytes descargados coinciden con la carga; el registro exige la reserva y los metadatos correspondientes. Storage rechaza lectura anónima y de otro estudiante, y el RPC rechaza a un docente ajeno. El docente propietario obtiene una descarga temporal autorizada.
- Corrección y publicación de tarea, reentrega autorizada y conservación de versiones. Actividad con calificación manual y publicación individual.
- Archivo y restauración de materia, retiro de inscripción, revocación de acceso al archivo, resolución del intento y reingreso que conserva las oportunidades ya consumidas.

## Concurrencia

Se enviaron solicitudes simultáneas desde clientes reales. Dos guardados sobre la misma revisión producen un guardado aceptado y un conflicto de revisión. Tres inicios sobre una actividad devuelven el mismo intento. Tres respuestas con la misma clave producen una sola respuesta; reutilizar la clave con otro contenido se rechaza. Son comprobaciones de exclusión e idempotencia, no una medición de capacidad máxima.

## Reproducción y datos de prueba

El ejecutor es [remote-verify.mjs](../../tools/datos/remote-verify.mjs). Requiere las variables privadas de conexión en `.env.local` y comprueba explícitamente el proyecto de destino antes de efectuar operaciones. Conserva las cuentas y el escenario en archivos locales excluidos de Git, para poder continuar las verificaciones de interfaz. No imprime contraseñas, claves ni URLs firmadas.

```powershell
node tools/datos/remote-verify.mjs
```

Una repetición reutiliza las cuentas pero crea un escenario nuevo. No debe ejecutarse contra datos de usuarios reales ni interpretarse como un procedimiento de limpieza.

## Límites

Este recorrido complementa las [55 comprobaciones en PostgreSQL aislado](datos-aislados.md); no las reemplaza ni significa que todas se hayan repetido remotamente. La expiración de treinta días, la purga tras confirmación de Storage y los límites de frecuencia tienen evidencia aislada. Su operación programada requiere una verificación adicional del trabajo periódico.

No se probaron entrega ni recuperación por correo, la meta de carga de 204 usuarios, accesibilidad o pantallas del navegador. El archivo subido es un pequeño contenido sintético para comprobar transferencia y autorización; no acredita la validación de firmas y contenido del endpoint web, que se comprueba por separado. Estas pruebas tampoco constituyen una autorización de producción.
