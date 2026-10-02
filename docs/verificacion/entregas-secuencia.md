# Archivos y reentregas con el servicio remoto

Las pruebas del 2 de octubre utilizaron la aplicación compilada local en el puerto 3001 y Supabase Auth y Storage reales. Son datos ficticios: el ensayo no implica utilizar trabajos de estudiantes ni publicar la aplicación.

| Caso | Resultado | Evidencia |
|---|---|---|
| AP-21 | Ocho comprobaciones: 11 MiB individual, seis archivos, 21 MiB acumulados, ejecutable renombrado, carga no confirmada e incompleta rechazados; la entrega válida permanece intacta. | [Secuencia remota](entregas-secuencia-remota.json). |
| AP-22 | Tres comprobaciones: reemplazo antes del cierre y sin calificar; versiones anterior y nueva conservan sus archivos. | [Secuencia remota](entregas-secuencia-remota.json). |
| AP-23 | Seis comprobaciones: entrega tardía deshabilitada/habilitada, marca de tardía, permiso requerido para reemplazar una versión calificada, uso único y rechazo tras vencer la ventana. | [Ejecución específica](entregas-secuencia-ap-23.json). |
| AP-24 | Cuatro comprobaciones: una carga fallida no reemplaza la entrega ni la nota; corrección con motivo y republicación de la nota anterior pasan de 80 a 85. | [Secuencia remota](entregas-secuencia-remota.json). |

El ensayo inicial de AP-23 asumía una apertura futura para el permiso de reentrega. El contrato abre la ventana cuando el docente concede el permiso y configura su vencimiento. Se corrigió la preparación de la prueba, sin cambiar la aplicación ni añadir una opción de apertura futura. El registro inicial conserva el resultado adverso y el posterior identifica la secuencia válida.

Los archivos pasan por reserva del servidor, subida autorizada y confirmación de bytes. Para la suma de 21 MiB se confirmaron tres PDF de 7 MiB; el rechazo ocurrió al enviar la entrega completa. Las materias ficticias se archivaron después. Las comprobaciones no sustituyen una recuperación integral ni una revisión manual de usabilidad.
