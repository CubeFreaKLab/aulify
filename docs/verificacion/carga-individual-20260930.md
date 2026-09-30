# Medición individual y límite de consulta de resultados

El ensayo completó cinco minutos de calentamiento y quince de medición individual con 200 estudiantes ficticios y cuatro docentes. En la medición, las 174.364 solicitudes no registraron errores técnicos y se conservaron las 2.000 respuestas confirmadas, sin duplicaciones ni cambios. El p95 de confirmación fue **2.665,11 ms**, superior a la meta de 1.500 ms. **Q-06 y Q-09 continúan abiertos.**

El [registro original](datos-carga-20260930041523.json) corresponde al compilado `P6WDnTpFwNCt3ILdxXorb`, código de aplicación `db3b1ad`, veintidós migraciones y Supabase Free en São Paulo. La aplicación y el generador HTTP corrieron en la computadora local. El campo `expectedMigration` del ejecutor todavía identifica la migración 21; no se usa como inventario completo. La migración 22 aplicada y sus comprobaciones se identifican en el [informe del resumen del aula](resumen-aula-20260930.md). No se alteró el esquema ni se reconstruyó la aplicación durante el ensayo.

| Fase individual | Duración | Solicitudes | Fallos | Respuestas persistidas | p95 de confirmación |
|---|---:|---:|---:|---:|---:|
| Calentamiento | 300,334 s | 60.203 | 0 | 2.000 | 2.010,39 ms |
| Medición | 900,091 s | 174.364 | 0 | 2.000 | 2.665,11 ms |

La ráfaga de medición inició las 200 respuestas en 1.890 ms, dentro de la ventana prevista de dos segundos. Los valores corresponden a solicitudes HTTP y persistencia, no al tiempo de dibujo de 204 navegadores.

La consulta de notas posterior al calentamiento comprobó las 200 cuentas. Después de la medición se publicaron las 200 notas, pero la lectura general falló en tres de las 84 solicitudes iniciadas. Se observaron 81 resultados correctos; el ejecutor detuvo nuevos trabajos y esperó a los ya iniciados. Estas consultas se registran separadas de las 174.364 solicitudes de la ventana de medición. El modo guiado no comenzó.

Los registros clasificaron las tres respuestas HTTP 503 como cancelaciones de PostgreSQL por tiempo agotado. El [diagnóstico](datos-carga-20260930041523-diagnostico.json) identifica la reconstrucción de comentarios por pregunta en `student_results` y el conteo general de preguntas. Esto localiza dónde se cancelaron las operaciones; no prueba una causa única. Una comparación posterior aislada de planes personalizados y genéricos tardó entre 91,24 y 572,47 ms en cuatro muestras de una cuenta con 24 intentos. No reprodujo el fallo ni justifica cambiar globalmente el planificador.

El ejecutor estimó 662.324.258 bytes para el ensayo, por debajo de su corte preventivo de 2.500.000.000. Es una estimación de transporte, no el consumo facturado. Las cuotas reales deben revisarse en el proveedor, que informa con demora. No se borró historial para facilitar la medición ni se redujeron los umbrales tras el resultado.

El siguiente paso es medir el costo de las partes de la consulta con el historial acumulado y bajo concurrencia acotada. Una corrección deberá conservar permisos, versiones, resultados publicados e historial, superar su regresión y justificar una nueva ejecución sostenida.
