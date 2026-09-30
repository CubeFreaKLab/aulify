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
