# Conexiones reservadas para confirmar cambios

La aplicación distribuye su límite de 128 conexiones HTTP/1.1 por origen e instancia entre **96 para lecturas y otras operaciones** y **32 reservadas para `aulify_command`**. El sondeo y la descarga de proyecciones ya no pueden ocupar el cupo completo de los comandos. Se mantienen doce segundos de plazo, cancelación del llamador, una solicitud por conexión y ausencia de reenvío automático de escrituras. La reserva organiza transporte; no sustituye autenticación, permisos ni transacciones.

## Motivo y comprobación local

El [diagnóstico anterior de cola](cola-transporte-20260930.md) mostró que las lecturas y comandos competían por un mismo pool. El [ensayo de 128 conexiones](diagnostico-transporte-128.md) terminó sin errores, pero con confirmación p95 de 3.047,92 ms. Ampliar el pool eliminó el corte de aquel diagnóstico, sin alcanzar la meta de latencia.

Dos pruebas adicionales usan un servidor HTTP real y conexiones limitadas. La primera ocupa todas las conexiones de lectura, deja otras lecturas en espera y comprueba que el comando recibe su respuesta antes de liberarlas; también contrasta cuerpos, credenciales individuales y rechazo de otro origen. La segunda llena el cupo de comandos y cancela el siguiente antes de enviarlo: el servidor recibe únicamente el primero y el posterior. Las cuatro pruebas previas conservan cobertura de reutilización, pérdida de conexión sin duplicar POST y vencimiento.

El 30 de septiembre aprobaron **159 pruebas en dieciocho archivos**, TypeScript, análisis focal y construcción `LxncBY74HOrDyZhjUMIuv`. Es una comprobación local del cambio. No equivale a aprobar Q-06, el comportamiento de Supabase bajo carga ni un despliegue de esta revisión. El CI previo `b5ef99a` tiene 157 pruebas y no contiene esta modificación.

## Diagnóstico que precede al cambio

Un perfil SQL aislado ejecutó ocho respuestas ordinarias y ocho respuestas finales, incluyendo restricciones diferidas. Las ordinarias tardaron entre 6,120 y 73,047 ms; las finales, entre 5,286 y 8,633 ms. Toda la transacción se revirtió. Son tiempos de una conexión sin carga: no incluyen HTTP, espera de conexiones, contención entre usuarios ni confirmación durable de un commit. No descartan un problema de base de datos bajo concurrencia.

También se compararon dos configuraciones de transporte mediante 968 lecturas de `aulify_sync`: ocho de preparación y cuatro rondas de 240, con concurrencia 96, dos cuentas ficticias existentes y orden HTTP/1.1, HTTP/2, HTTP/2, HTTP/1.1. Se verificaron la huella y el plazo por rol, excluyendo del contraste la hora variable del servidor. No se enviaron respuestas de estudiantes ni se cambió contenido.

| Ronda | Configuración | Conexiones observadas | p50 | p95 | Fallos |
|---|---|---:|---:|---:|---:|
| 1 | HTTP/1.1, límite 128 | 96 | 1.259,52 ms | 2.574,43 ms | 0 |
| 2 | HTTP/2, límite 4, pipelining 1 | 4 | 3.566,77 ms | 3.686,06 ms | 0 |
| 3 | HTTP/2, límite 4, pipelining 1 | 4 | 3.511,69 ms | 3.616,54 ms | 0 |
| 4 | HTTP/1.1, límite 128 | 96 | 201,20 ms | 484,20 ms | 0 |

La negociación TLS confirmó el protocolo esperado y validó los certificados. HTTP/2 con esta configuración no aportó una mejora, por lo que no se incorporó. No es una comparación de todas las configuraciones posibles: `pipelining: 1` conserva una solicitud activa por cliente, y los POST no idempotentes tienen restricciones adicionales. Tampoco hay suficientes repeticiones para atribuir toda la variación al protocolo. Referencias: [opciones de Undici 7.30.0](https://github.com/nodejs/undici/blob/v7.30.0/docs/docs/api/Client.md) y [despacho HTTP/2](https://github.com/nodejs/undici/blob/v7.30.0/lib/dispatcher/client-h2.js).

El ensayo de lectura transcurrió entre 06:55:17 y 06:55:50 UTC. Recibió 142.206 bytes de cuerpos y estimó conservadoramente 1.275.644 bytes, sin incluir el tráfico de preparación de Auth y snapshot en ese cálculo. El margen de cuota se comprobó antes. No sustituye el contador facturable ni el escenario sostenido.

Supabase publicó una [incidencia de latencia desde el este de EE. UU.](https://status.supabase.com/incidents/w91bvbjhqf0f), aún abierta en la consulta. Las respuestas de esta comparación identificaron el punto de entrada `LPB`; esto no describe toda su ruta interna. No se atribuye el fallo de capacidad de Aulify a esa incidencia sin evidencia adicional.

## Límites

La reserva evita una forma de competencia en la cola del proceso. Las dos clases de tráfico siguen compartiendo red, gateway y base de datos; por tanto, una lectura lenta todavía puede competir por recursos del servicio. El límite es por instancia del módulo, no global para todas las funciones de alojamiento. El proxy de autenticación conserva su transporte anterior.

La prueba remota del candidato debe registrar su compilado, volumen, errores y persistencia. Q-06 y Q-09 mantienen los requisitos completos del plan de calidad.
