# Medición por etapas de las rutas

Las respuestas correctas de comandos, sincronización y workspace incorporan `Server-Timing` con tres duraciones en milisegundos: `prepare`, `rpc` y `encode`. No se incluyen identificadores, argumentos, claves, textos del servicio ni contenido de respuestas.

`prepare` abarca el tiempo desde la entrada al handler hasta iniciar el RPC: validación, lectura del cuerpo cuando corresponde y comprobación de identidad. **No incluye el proxy anterior a la ruta**. `rpc` mide la llamada del SDK y la recepción de datos desde Supabase: incluye transporte y esperas del servicio, no sólo ejecución SQL. `encode` mide la creación de la respuesta JSON; excluye su transferencia al cliente.

El ejecutor de carga conserva únicamente esos tres nombres y valores numéricos. La diferencia entre duración HTTP completa y suma de etapas agrupa tiempos fuera del handler; no permite atribuirlos por sí sola a red, proxy, cola o transferencia. Comparar las etapas de cada solicitud evita restar percentiles de conjuntos diferentes.

Verificación del 30 de septiembre de 2026 UTC: **53 pruebas de las rutas aprobadas** y una prueba del parser que rechaza campos desconocidos, descripciones y valores inválidos. Inicialmente el ejecutor de unidad no resolvía el alias del módulo nuevo; se añadió su importación real, siguiendo la configuración de las pruebas existentes. El análisis estático focal y la compilación posterior terminaron correctamente. Build: `qXB8VvHBsVVEAq3ph37vn`.

La instrumentación no cambia autenticación, permisos, reintentos, respuestas ni frecuencia del sondeo. No representa una optimización ni una aprobación de capacidad.
