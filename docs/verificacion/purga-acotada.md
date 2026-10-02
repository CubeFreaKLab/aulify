# Restauración y reintento de eliminación por trabajo

La migración `20261002221000_aulify_scoped_purge_retry.sql` permite que el servicio reintente un trabajo de eliminación identificado por UUID. El mantenimiento programado conserva su operación global. El nuevo recorrido no es accesible a estudiantes ni docentes y limita confirmaciones y archivos al trabajo solicitado.

Esta separación permite recuperar una eliminación parcial sin intervenir en otras materias elegibles. También permite repetir el trabajo después de retirar la materia, cuando su referencia ya no existe. No añade tablas ni cambia las relaciones del modelo.

## Comprobaciones

Quince comprobaciones en PostgreSQL aislado aprobaron límites por trabajo, denegación a usuarios, conservación de otros trabajos, rechazo de archivos ajenos, confirmación con bytes todavía existentes, reintento e idempotencia. Véase el [registro aislado](mantenimiento-acotado.json).

El [ensayo remoto](purga-acotada-remota.json) aprobó dieciséis comprobaciones con JWT y Storage reales. Restauración y mantenimiento se solicitaron concurrentemente: antes de vencer se conservó la materia; al vencer, la restauración fue rechazada y el trabajo reclamó únicamente sus dos archivos. Tras eliminar el primero se interrumpió la secuencia; el reintento recuperó ambos metadatos pendientes y completó la eliminación al retirar el segundo objeto. La biblioteca y otras materias conservaron su proyección.

Las fechas de treinta días son sintéticas. La concurrencia HTTP no instrumenta los tiempos internos de bloqueo SQL; estos se estudiaron por separado con [conexiones locales independientes](carrera-restauracion-purga.md). El plazo del programador conserva la [observación real anterior](conservacion-programada.md).

## Descarga y caché

La primera comprobación de descarga posterior encontró una respuesta administrativa previamente consultada, aunque la materia y los metadatos ya habían sido retirados. El [registro de esa observación](purga-acotada-cache-observacion.json) conserva quince comprobaciones y el resultado adverso. La ejecución posterior utiliza una consulta nueva mediante `cacheNonce`; ambos objetos resultaron inexistentes en el origen. No se afirma que puedan revocarse bytes ya descargados ni que toda caché se elimine inmediatamente. [Tratamiento de caché de Supabase](https://supabase.com/docs/guides/storage/cdn/smart-cdn).

La primera preparación venció mientras se coordinaba el ensayo y no pudo restaurarse. Se utilizó un fixture nuevo; no se ampliaron plazos de materias reales ni se reabrieron intentos anteriores.
