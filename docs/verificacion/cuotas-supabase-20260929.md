# Consumo observado en Supabase Free

Consulta de solo lectura del 29 de septiembre de 2026, 23:41 UTC, en el [panel de uso de Aulify](https://supabase.com/dashboard/org/hxjydfpcwadwpefonhbv/usage). Organización `hxjydfpcwadwpefonhbv`; proyecto `bnqyyumfmyexsqszglab`. El panel identifica el plan Free y el ciclo del 28 de septiembre al 28 de octubre de 2026. No se modificaron servicios, planes ni facturación.

| Indicador del resumen | Consumo mostrado | Cuota mostrada |
|---|---:|---:|
| Transferencia saliente sin caché | 0,159 GB | 5 GB |
| Base de datos | 0,042 GB | 0,5 GB |
| Usuarios activos mensuales | 209 | 50.000 |
| Almacenamiento | 0 GB, redondeado | 1 GB |
| Transferencia servida desde caché | 0 GB, redondeado | 5 GB |
| Pico de conexiones Realtime | 0 | 200 |
| Mensajes Realtime | 0 | 2.000.000 |
| Invocaciones Edge Functions | 0 | 500.000 |

La sección detallada de base de datos muestra 39,61 MB para Aulify. El resumen usa otra unidad y redondeo; no se interpreta como dos mediciones de crecimiento. Que Storage se muestre como cero redondeado no implica ausencia de archivos.

El panel informa que no se excedieron las cuotas. El margen aritmético de transferencia mostrado es 4,841 GB, sujeto al retraso del proveedor: el resumen puede tardar hasta una hora en actualizarse y los usuarios activos hasta 24 horas. Esta observación no es una garantía de cuota en tiempo real ni una reserva de capacidad.

También aparecen 0,165/1 GB de ingestión de registros y 1,038/100 GB consultados, ambos señalados como próximos controles. El panel sitúa su aplicación al inicio de 2027; no se presentan como cargos activados durante esta comprobación.

La lectura permite preparar un diagnóstico limitado, manteniendo sus cortes de seguridad. No aprueba Q-06 ni Q-09: todavía falta ejecutar y medir el escenario completo dentro de sus cuotas. Los ceros de Realtime corresponden a la arquitectura actual de consultas HTTP, no a una prueba de doscientas conexiones en ese servicio.

## Lectura posterior

El 30 de septiembre a las 00:59 UTC se volvió a observar el mismo panel, organización y ciclo. El resumen mostró **0,175/5 GB de transferencia**, **0,043/0,5 GB de base de datos** y **209/50.000 usuarios activos**. Storage y transferencia desde caché seguían en cero redondeado; Realtime permanecía en cero conexiones y mensajes. El panel indicó que no se excedieron las cuotas Free. Los contadores de registros mostraban 0,19/1 GB de ingestión y 2,454/100 GB consultados, todavía identificados como próximos controles. Se mantienen las advertencias de actualización diferida; no se cambió el plan ni se activó facturación.

A las 02:21 UTC se comprobó nuevamente el panel de Aulify Free, en el mismo ciclo y proyecto: **0,208/5 GB de transferencia**, **0,047/0,5 GB de base de datos** y **209/50.000 usuarios activos**. El detalle de base mostraba 44,53 MB. Registros: 0,241/1 GB de ingestión y 3,878/100 GB consultados, aún bajo la indicación de próximos controles. Ninguna cuota figuraba excedida.

Para el escenario sostenido se admite un presupuesto preventivo máximo de 2,5 GB de transferencia adicional estimada, con corte al superarlo, dentro del margen mostrado de 4,792 GB. Este presupuesto incluye preparación y auditorías, duplica los bytes JSON descomprimidos y añade 1.024 bytes por solicitud. Es deliberadamente distinto del consumo facturable: hay retraso del panel, otros componentes y gastos no medidos por el generador. Se conserva margen adicional y se debe revisar el contador tras finalizar. El cambio de presupuesto no modifica los umbrales de rendimiento ni activa servicios de pago.

## Revisión previa al diagnóstico de tiempos

Antes de iniciar el escenario sostenido posterior a la migración 22, el 30 de septiembre a las 04:16 UTC, se observó **0,347/5 GB de transferencia**, **0,054/0,5 GB de base de datos** (51,55 MB en el detalle) y 209 usuarios activos. La transferencia seguía mostrando el valor previo, por lo que se considera el retraso de actualización. Los registros mostraron 0,443/1 GB y 4,314/100 GB, todavía como controles próximos de 2027. Se mantuvo Free y el corte preventivo de 2,5 GB estimados adicionales. El diagnóstico precedente consumió 280 MB estimados y la regresión posterior recibió 11,19 MB de JSON; se conserva margen adicional frente a ambas medidas.

Lectura posterior del mismo panel, registrada el 30 de septiembre a las 03:33 UTC: **0,347/5 GB de transferencia**, **0,052/0,5 GB de base de datos** y **209/50.000 usuarios activos**. El detalle de base de datos muestra 49,39 MB. Storage y transferencia desde caché permanecen en cero redondeado; Realtime, en cero conexiones y mensajes. El panel identifica Free, el mismo ciclo y ninguna cuota excedida. Los registros muestran 0,443/1 GB de ingestión y 4,314/100 GB consultados, todavía señalados como próximos controles de 2027.

Esta lectura permite un diagnóstico adicional con límite preventivo de **500 MB estimados**, inferior al presupuesto del protocolo completo. Repite únicamente cinco minutos individuales y la preparación posterior que falló, ahora con tiempos HTTP por etapa y por número de pregunta. No cambia la aplicación, no ejecuta mantenimiento y no aprueba capacidad. El retraso de actualización del panel impide tratar el margen mostrado como consumo instantáneo.

## Lectura tras el ensayo individual

El 30 de septiembre, aproximadamente a las 05:03 UTC, el panel mostró **0,447/5 GB de transferencia**, **0,059/0,5 GB de base de datos** (56,26 MB en el detalle) y **209 usuarios activos**. Indicó que ninguna cuota Free estaba excedida. Registros: 0,593/1 GB de ingestión y 7,129/100 GB consultados, todavía como controles próximos de 2027. Las métricas de CPU y memoria del informe de base de datos figuraban como no disponibles; no se deduce de esa ausencia que hubiera o no saturación. Se mantienen el retraso del contador y los límites preventivos de prueba.

Aproximadamente a las 06:53 UTC se observó **0,924/5 GB de transferencia**, **0,064/0,5 GB de base de datos** (61,15 MB en el detalle), **209 usuarios activos** y 0,001/5 GB de transferencia desde caché. El resumen declaró que no se excedieron las cuotas vigentes de Free. La ingestión de registros mostraba 1,366/1 GB (137 %) y la consulta 7,224/100 GB; ambos controles seguían marcados como próximos, con aplicación en 2027. Se registra el exceso del contador de ingestión sin confundirlo con un cobro o restricción actualmente aplicada. No se modificó el plan.
