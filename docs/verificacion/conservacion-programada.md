# Observación del mantenimiento programado

**Observación aprobada para el caso preparado.** El mantenimiento programado eliminó una materia ficticia y su archivo exclusivo en **2 horas, 7 minutos y 58,496 segundos** desde su elegibilidad. El [registro completo](conservacion-programada.json) conserva siete comprobaciones, las huellas de los registros descargados y el resultado de Storage. La [lectura inicial](conservacion-programada-elegibilidad.json) había confirmado el trabajo programado y el objeto presente.

- Elegible desde: **30 de septiembre de 2026, 03:25:14 UTC**.
- Límite del objetivo de 24 horas: **1 de octubre de 2026, 03:25:14 UTC**.
- Trabajo: `f64c3e18-d491-4379-8c89-68aa9a75aa75`.
- Cierre del trabajo: **30 de septiembre de 2026, 05:33:12,835 UTC**, sin reintentos ni error registrado.
- Ejecución de Actions: [36673912107](https://github.com/CubeFreaKLab/aulify/actions/runs/36673912107), evento `schedule`, resultado `success`, revisión `d41e381358c1d3d7c28bd21a077b8df0b5b482ef`.
- Workflow existente: [mantenimiento.yml](../../.github/workflows/mantenimiento.yml), programado cada seis horas.

La antigüedad de archivo de treinta días es sintética y está identificada como tal en el SQL. La espera desde la elegibilidad preparada hasta el cierre fue real. No se modificó la frecuencia del workflow ni se llamó manualmente a `tick` durante esa espera.

La ejecución comenzó a las 05:32:55 UTC y terminó a las 05:33:33 UTC; `completed_at` queda dentro de esa ventana. El registro descargado informa `deletedFileRecords: 1`. La [lectura posterior de PostgreSQL](conservacion-programada-resultado.json), a las 06:16:18 UTC, confirmó el trabajo terminado y la ausencia de la materia, el metadato del archivo y el objeto en el catálogo de Storage. El [observador de sólo lectura](../../tools/datos/retention-scheduled-observe.mjs) contrastó esas evidencias, realizó un listado autorizado sin encontrar el objeto y obtuvo `404 Object not found` al intentar descargarlo con credenciales de servidor. No invocó mantenimiento ni borró archivos.

Un solo caso dentro del límite no constituye un SLA general. Esta observación tampoco sustituye la carrera entre restauración y purga, comprobada localmente y aún pendiente en el entorno remoto.
