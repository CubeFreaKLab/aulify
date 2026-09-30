# Diagnóstico de consulta de resultados

El diagnóstico limitado de `80f3377` mantuvo la aplicación compilada `9b84oYZaFQkaf5OmYT5AJ`, basada en `02a6ab1`, y las veintiuna migraciones remotas. Se prepararon las 204 sesiones ficticias existentes sin crear cuentas y sin esperas por límites de Auth. El presupuesto preventivo fue de 500 MB; la estimación final alcanzó 280,30 MB, distinta de la facturación del proveedor.

El calentamiento individual transcurrió entre las 03:44:00 y las 03:49:00 UTC del 30 de septiembre, durante 300,079 segundos. El [resultado agregado](datos-diagnostico-snapshot-20260930.json) deriva de las muestras originales, conservadas localmente con su SHA-256; su tratamiento posterior no es una nueva ejecución.

| Operación durante los cinco minutos | Solicitudes | Fallos | p95 HTTP |
|---|---:|---:|---:|
| Consulta de revisión | 56.622 | 4 | 852,45 ms |
| Descarga de actividad | 2.356 | 1 | 2.047,92 ms |
| Envío de respuesta | 2.000 | 0 | 1.141,03 ms |

La auditoría confirmó **2.000 respuestas persistidas y reconocidas**, sin pérdidas, cambios de clave ni duplicados. El p95 de confirmación completa fue 1.141,10 ms. Los cinco fallos de lectura agotaron la espera HTTP de quince segundos; no fueron fallos de envío de respuestas. Este calentamiento no sustituye las mediciones individuales y guiadas del protocolo completo.

La publicación posterior de 200 calificaciones terminó en 6,443 segundos. El fallo que detuvo el diagnóstico ocurrió al consultar resultados publicados: 51 solicitudes iniciadas, 48 correctas, dos respuestas 503 y un agotamiento de espera. El ejecutor drenó las solicitudes ya iniciadas y no completó las 200 consultas previstas. No alcanzó la preparación de la actividad siguiente.

## Localización de la demora

La instrumentación separa preparación del endpoint, RPC y codificación. En los 48 resultados correctos, el p95 de RPC fue 13.267,65 ms, frente a 5,32 ms de preparación y 1,32 ms de codificación. Estos percentiles se calculan por componente y no se suman para reconstruir el percentil total. El tiempo RPC incluye red, servicio HTTP y PostgreSQL; no es tiempo SQL aislado.

Los [registros de PostgreSQL](diagnostico-snapshot-logs-20260930.json) muestran dos cancelaciones `57014` a las 03:49:34 y 03:49:40 UTC. Sus contextos pertenecen a `app.snapshot()`: construcción de preguntas de actividades estudiantiles y cálculo del estado de resultados. El primer contexto termina en `question_json`; el segundo, en `attempt_score` dentro de `student_results`.

La consulta general recopila las actividades autorizadas y construye sus vistas completas, además de intentos y resultados. Esto identifica una ruta concreta de consulta que requiere acotación o reducción del trabajo repetido. El diagnóstico no demuestra que esa sea la causa exclusiva de toda demora de red, ni reproduce el anterior fallo de inicio de intentos: los 200 inicios de esta ejecución pasaron, con p95 de 206,04 ms.

La siguiente corrección debe conservar autorización, publicación de notas, plazos y acceso al historial. Se verificará primero equivalencia y privacidad, y después su efecto medido; no se rebajan umbrales ni se elimina historial para mejorar la cifra. La observación de limpieza programada sigue separada y no se ejecutó mantenimiento manual.
