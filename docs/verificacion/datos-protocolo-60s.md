# Diagnóstico de un minuto del protocolo de actividad

Este diagnóstico no sustituye Q-06: se ejecutó un minuto, con una pregunta y sin calentamiento ni fase guiada. El p95 de confirmación observado superó el objetivo de 1,5 segundos, por lo que no justifica declarar capacidad aprobada.

## Entorno y procedimiento

Compilado local `7sRhvomkfVIG0kD7-y2WS`, base Supabase Free remota, revisión del repositorio `c8432b82ff03326b4fe47b1452dc762ab0cbb5e0`. La preparación comenzó 2026-09-28T12:33:13.123Z y renovó 204 sesiones ficticias con separación de 2,5 segundos cuando correspondía. No hubo esperas por límites Auth durante esta preparación. La ventana de tráfico fue 2026-09-28T12:41:06.415Z a 2026-09-28T12:42:06.761Z.

Cuatro docentes y doscientos estudiantes se distribuyeron en cuatro actividades nuevas. Cada sesión consultó `/api/sync` cada segundo, escalonada dentro del segundo, sin superponer consultas de la misma sesión. Solo un cambio de revisión solicitó `/api/workspace?activity=...`. Los fallos emplearon espera de 1, 2, 4 y 8 segundos. A los veinte segundos se distribuyeron doscientos envíos de respuesta en una ventana objetivo de dos segundos. La respuesta HTTP contiene el intento persistido; una auditoría posterior contrastó sus claves de idempotencia. No hubo cambios de código o esquema durante la medición.

## Resultado

| Operación | Solicitudes | Fallos | p95 (ms) |
|---|---:|---:|---:|
| Huella | 9963 | 4 | 1361.46 |
| Actividad acotada | 416 | 5 | 5088.73 |
| Respuesta | 200 | 0 | 3404.94 |

La ráfaga despachó 200 respuestas en 1892.18 ms. Se confirmaron 200 y se encontraron las 200 persistidas, sin claves confirmadas ausentes o modificadas. El p95 de confirmación fue 3404.96 ms, superior a 1.500 ms. Hubo 9 fallos entre 10,579 solicitudes medidas (0.0851 %): cuatro HTTP 503 alrededor de diez segundos y cinco tiempos de espera del generador alrededor de quince segundos. No hubo fallos de respuesta; los nueve correspondieron a lectura.

Se omitieron 2229 ticks porque una consulta previa seguía activa, existía una espera de reintento o había terminado la ventana. El generador tuvo un retraso del bucle de eventos p95 de 31.83 ms. Esos datos ayudan a interpretar el ritmo efectivo; no se sustituyen los ticks omitidos por solicitudes supuestas.

Se observaron 14.15 MB de cuerpos HTTP, incluyendo preparación y auditoría; la estimación preventiva fue 39.56 MB. No se alcanzó el límite de 1 GB adicional ni el corte por más del 10 % de fallos en un minuto. La estimación no equivale al contador de Supabase.

## Interpretación y siguiente decisión

La persistencia y la idempotencia se mantuvieron en esta ráfaga, pero la confirmación de respuesta no alcanzó el umbral bajo el tráfico concurrente. La lectura acotada y los contadores redujeron el volumen y evitaron reconstruir el espacio completo; todavía existen esperas de lectura y latencia de cola. El resultado sugiere investigar la saturación del camino HTTP/RPC y el costo de actualizar los contadores compartidos, sin atribuir la causa exacta a una capa solo con estos tiempos.

Antes de otro ensayo de cuarenta minutos, obtener tiempos del servidor/base y comparar una mejora concreta conservando los mismos permisos, escenario y umbrales. La reducción del número de usuarios o el aumento del umbral no serían una corrección del requisito. La propagación de pregunta guiada no fue medida.

[Mediciones y registros](datos-protocolo-60s-20260928123313.json) · [Ejecutor](../../tools/datos/load-protocol.mjs) · [Sondeos anteriores](datos-sondeos.md).
