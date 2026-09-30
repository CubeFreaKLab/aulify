# Calentamiento sostenido y fallo de preparación

El escenario completo no terminó. El calentamiento individual de cinco minutos conservó las **2.000 respuestas confirmadas**, sin pérdidas, cambios de clave ni duplicados. Sus **59.256 solicitudes no registraron fallos**, pero el p95 de confirmación fue **2.347,96 ms**, superior a la meta de 1.500 ms. La fase de quince minutos y el modo guiado no llegaron a ejecutarse; Q-06 y Q-09 permanecen abiertos.

El [registro original](datos-carga-20260930022647.json) corresponde al compilado `9b84oYZaFQkaf5OmYT5AJ`, aplicación local y Supabase Free con veinte migraciones. La ventana de calentamiento fue 02:35:31–02:40:31 UTC del 30 de septiembre de 2026, con 204 sesiones preparadas, diez preguntas, sondeo de un segundo y datos ficticios. La auditoría contrastó cada clave confirmada; las 200 lecturas de resultados publicados fueron correctas. Preparación, auditoría y publicación no se suman a la ventana de medición.

| Operación durante calentamiento | Solicitudes | Fallos | p95 HTTP |
|---|---:|---:|---:|
| Sincronización | 54.910 | 0 | 803,51 ms |
| Proyección por actividad | 2.346 | 0 | 2.505,96 ms |
| Envío de respuesta | 2.000 | 0 | 2.347,91 ms |

Al preparar los intentos de las actividades siguientes, la API devolvió HTTP 503. Los registros del servidor clasificaron cuatro fallos como `database_cancelled`. La consulta de PostgreSQL en esa ventana mostró código 57014 y esperas en `app.ensure_participant`, al bloquear la fila de actividad, además de cancelaciones dentro de `app.begin_attempt` y una inserción de participante. El [diagnóstico complementario](datos-carga-20260930022647-diagnostico.json) conserva una muestra y la auditoría posterior. Esto localiza el punto de espera, pero no demuestra todavía la causa inicial que retuvo el bloqueo ni explica por sí solo la latencia del calentamiento.

Se identificó además un defecto del generador: `Promise.all` propagaba el primer rechazo mientras otros trabajadores seguían preparando intentos. La auditoría posterior encontró 196 intentos de la fase siguiente, distribuidos 50/46/50/50. Por ello, los totales globales de solicitudes y transferencia del archivo original no cubren toda esa cola posterior y no se presentan como consumo completo. Las métricas del calentamiento y su auditoría sí habían terminado antes de ese fallo.

El generador ahora detiene nuevos trabajos y espera los ya iniciados antes de cerrar el informe; dos pruebas locales comprobaron ese comportamiento y tres verificaron el evaluador de criterios. También registra operaciones de preparación y la categoría del fallo, sin guardar credenciales ni cuerpos privados. Es una corrección de medición, no una solución del rendimiento de la plataforma. No se repitió la carga después de este fallo.

El diagnóstico breve anterior de 797,21 ms sigue siendo válido para aquella ventana de un minuto; no representa el comportamiento sostenido de diez preguntas. La corrección posterior de conservación, migración 21, se aplicó cuando el proceso de carga ya había concluido y no modifica estos resultados.

El [perfil SQL posterior](inicio-intento-perfil-remoto.json), sin carga concurrente, separó comprobación de pertenencia, alta de participante, construcción del intento, serialización y triggers diferidos. Todas las escrituras se revirtieron. La primera serie reunió cinco muestras; una segunda de doce exploró si aparecía una degradación tras las primeras ejecuciones. El inicio no reprodujo la espera de varios segundos: `begin_attempt` osciló entre 5,10 y 83,79 ms en ambas series. Siguen faltando los tiempos por etapa del recorrido HTTP sostenido; no se concluye que el bloqueo haya quedado resuelto ni se modifica el esquema a partir de esta observación aislada.

El ejecutor incorporó después los encabezados numéricos `Server-Timing` ya disponibles en la API. Registra preparación, RPC, codificación y tiempo restante por solicitud, tanto en preparación como en las fases; RPC incluye red y servicio, no sólo SQL. También separa el ACK por número de pregunta. Los percentiles de etapas no se suman ni se restan entre sí; las cabeceras incompletas no se convierten en ceros. Ocho pruebas locales del parser, agregación, criterios y drenaje aprobaron. Esta instrumentación no se usó en el ensayo anterior ni representa una mejora de rendimiento de la aplicación; no se repitió la carga todavía.
