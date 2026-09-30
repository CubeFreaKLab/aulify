# Conexiones reutilizables hacia Supabase

La aplicación utiliza un pool de **hasta 128 conexiones HTTP/1.1 por origen e instancia del módulo de servidor**, con una solicitud activa por conexión y conservación de conexiones ociosas hasta treinta segundos, sujeta a lo indicado por el servicio. Cada operación al servicio tiene un plazo de doce segundos, combinado con la cancelación del llamador. Undici 7.30.0 queda fijado en el archivo de dependencias. No se modifica el dispatcher global de Node ni se comparte información de autenticación: cada solicitud conserva sus propias cabeceras y cuerpo.

El cambio se aplica al cliente Supabase de las rutas de servidor. El proxy mantiene su transporte anterior. El pool se reutiliza entre solicitudes a un mismo origen, rechaza destinos distintos y no incorpora un mecanismo de reenvío de comandos. No equivale a limitar a 128 conexiones toda una instalación con varios procesos o funciones. La [revisión posterior](cola-transporte-20260930.md) explica el aumento desde 64 y el plazo; las mediciones históricas siguientes pertenecen al límite anterior.

## Motivo y límite de la decisión

El [diagnóstico instrumentado](datos-protocolo-60s-20260930020714.json) conservó 200/200 respuestas y no tuvo errores, pero su p95 de ACK de 3.231,21 ms todavía excedió 1.500 ms. La mayor parte de la espera de esas respuestas se observó dentro de la llamada RPC. En los últimos quince segundos, 3.025 sincronizaciones tuvieron una media RPC de 170,46 ms; aproximadamente 204 lecturas por segundo necesitan unas 35 solicitudes simultáneas en ese estado. El límite 64 deja margen para la ráfaga y evita creación ilimitada de conexiones. Es una decisión que necesita medición, no una garantía de capacidad.

La implementación anterior delegaba al pool predeterminado. La documentación de Undici describe `connections: null` como número ilimitado de clientes y `pipelining: 1` como una solicitud por conexión. Se conserva explícitamente HTTP/1.1; no se activa HTTP/2 ni pipelining adicional. [Pool](https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Pool.md), [Client](https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Client.md).

## Verificación

Un servidor HTTP local recibió veinte POST simultáneos mediante un pool configurado con cuatro conexiones: no se superó ese límite, los veinte cuerpos y tokens ficticios permanecieron asociados a su solicitud y no hubo duplicación. En otro caso, el servidor cortó la conexión después de recibir un POST; el cliente propagó el fallo sin reenviarlo. Se cerraron servidores y pools de ambos ensayos.

Pasaron **151 pruebas locales en diecisiete archivos**, incluidos los escenarios de Auth, y el análisis estático focal. La construcción final con límite 64 terminó correctamente: `9b84oYZaFQkaf5OmYT5AJ`. El ensayo local verifica transporte y aislamiento, no rendimiento remoto. Q-06 sigue pendiente hasta medir el escenario correspondiente.

## Diagnóstico remoto de sesenta segundos

Entre 02:15:35 y 02:16:35 UTC del 30 de septiembre, el compilado indicado atendió 204 sesiones HTTP contra Supabase Free y conservó las veinte migraciones. Las 200 respuestas de una ráfaga de 1.885,49 ms quedaron confirmadas y persistidas; la auditoría no detectó claves perdidas o cambiadas. Hubo 11.641 solicitudes durante la medición, sin fallos. El p95 de confirmación fue **797,21 ms**, frente a 3.231,21 ms en el diagnóstico instrumentado previo. La observación respalda continuar con la prueba completa, pero una comparación secuencial breve no demuestra por sí sola capacidad sostenida ni aísla todas las variaciones de red.

El p95 de sincronización fue 917,98 ms y el de descarga de la proyección, 2.210,45 ms. La propagación guiada todavía requiere medición independiente. Los cuerpos recibidos sumaron 17.928.210 bytes incluyendo preparación y auditoría; el cálculo preventivo fue 48.198.692 bytes, que no es el contador facturable del proveedor.

Se conservan las [mediciones originales](datos-protocolo-60s-20260930021436.json) y el [resumen de tiempos](datos-tiempos-rutas-pool64.json). Q-06 y Q-09 siguen abiertos hasta cubrir los cuatro grupos, diez preguntas y las fases completas de cada modalidad.
