# Observación del mantenimiento programado

**Pendiente de resultado.** Se preparó una materia ficticia con una entrega y un objeto exclusivo en Storage para medir el tiempo real hasta la ejecución automática del mantenimiento. El [registro de preparación](conservacion-programada.json) identifica el fixture y sus límites; la [lectura de elegibilidad](conservacion-programada-elegibilidad.json) confirmó el trabajo programado y el objeto todavía presente.

- Elegible desde: **30 de septiembre de 2026, 03:25:14 UTC**.
- Límite del objetivo de 24 horas: **1 de octubre de 2026, 03:25:14 UTC**.
- Trabajo: `f64c3e18-d491-4379-8c89-68aa9a75aa75`.
- Workflow existente: [mantenimiento.yml](../../.github/workflows/mantenimiento.yml), programado cada seis horas.

La antigüedad de archivo de treinta días es sintética y está identificada como tal en el SQL. La espera desde la elegibilidad preparada hasta el cierre será real. No se modificó la frecuencia del workflow ni se llamó manualmente a `tick` después de preparar este fixture. Una ejecución manual durante esta ventana invalidaría la atribución del resultado al programador.

Para cerrar esta comprobación se debe identificar una ejecución con evento `schedule`, comprobar sus registros y contrastar su ventana con `completed_at` del trabajo. También deben haber desaparecido la materia, el metadato del archivo y el objeto de Storage. El workflow aprobado por sí solo no prueba esos efectos. Se conservarán el tiempo observado y cualquier retraso; no se cambiará el umbral para aprobar el resultado.

Un solo caso dentro del límite no constituye un SLA general. Esta observación tampoco sustituye la carrera entre restauración y purga, comprobada localmente y aún pendiente en el entorno remoto.
