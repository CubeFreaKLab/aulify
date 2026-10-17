# 0005 · Avisos de actividad mediante el servidor

Estado: implementación en curso; capacidad pendiente de medir.

El diagnóstico con cuatro docentes y doscientos estudiantes reproduce demoras después de varios minutos de sondeo. Las muestras no muestran bloqueo entre transacciones ni nuevas lecturas de bloques durante ese tramo. Esta observación no identifica por sí sola una causa única, pero justifica reducir las consultas que se repiten cuando no cambia ningún dato.

El servidor de Aulify escuchará avisos privados de Supabase Broadcast y los distribuirá mediante eventos HTTP (SSE) a los estudiantes que ya tengan acceso a la actividad. Compartirá una suscripción por actividad e instancia del servidor. Los navegadores no abrirán doscientos sockets adicionales con Supabase.

Los avisos contienen identificadores de encaminamiento y revocación, nunca respuestas, soluciones ni notas. El navegador vuelve a consultar los endpoints autorizados para obtener datos. Una respuesta propia continúa confirmándose mediante el comando transaccional; no depende de la llegada del aviso.

Se conserva el sondeo docente de un segundo. El estudiante conectado utiliza avisos y una comprobación periódica de treinta segundos; al perder el canal vuelve al sondeo de un segundo. También comprueba el vencimiento indicado por el servidor. La conexión HTTP se renueva antes del límite de duración del alojamiento.

La autorización de datos y los umbrales no cambian: confirmación p95 ≤ 1,5 s, propagación guiada p95 ≤ 2 s, menos del 1 % de fallos y ninguna pérdida o duplicación confirmada. La nueva ejecución debe registrar SSE, consumo y conexiones Realtime; no se atribuyen al transporte nuevo los ensayos anteriores.

Referencias: [Broadcast](https://supabase.com/docs/guides/realtime/broadcast), [límites de Realtime](https://supabase.com/docs/guides/realtime/limits) y [duración de Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration).
