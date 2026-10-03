# Aviso, datos mínimos y revisión de una señal

El 2 de octubre de 2026 se comprobó el aviso previo de un examen, el almacenamiento mínimo de una señal y su revisión docente. Se utilizó la aplicación compilada local de `4fa2c2d`, Supabase remoto y dos cuentas ficticias. La señal se envió mediante el contrato autenticado; no se presenta como un cambio físico de pestaña comprobado.

## Procedimiento y resultados

1. Crear una materia y aprobar a una estudiante ficticia mediante código. Publicar un recurso de tres preguntas y una actividad de examen individual, con seguimiento de visibilidad habilitado.
2. Entrar como estudiante. Antes de comenzar, comprobar el aviso: se registra cuándo deja de verse la pestaña; no se sabe qué aplicación se utiliza, no se prueba una trampa y no hay sanciones automáticas. [Captura del aviso](visibilidad-aviso.png).
3. Empezar y responder correctamente la primera pregunta desde la interfaz. Guardar el estado anterior: una respuesta con su corrección, ninguna señal, intento abierto y ninguna nota nueva.
4. Intentar el cambio entre dos pestañas mediante el navegador disponible. Ambas siguieron indicando `visible` y no se recibió una señal. Esta sesión de automatización no permite verificar esa transición; no se inyectó un evento DOM ni se atribuyó el resultado a un cambio físico.
5. Enviar una señal sintética por `reportVisibility` con la sesión JWT de la estudiante. Inspeccionar únicamente las columnas y el conteo de su evento. Se conservan `id`, `attempt_id`, `client_event_key`, `hidden_at`, `visible_at` y `received_at`; el intervalo es válido. No se incorporan otras aplicaciones, teclas, cámara ni micrófono.
6. Comparar el intento antes y después. La respuesta, sus revisiones de puntuación y el estado abierto coinciden; no se crearon ni modificaron evaluaciones.
7. Entrar como docente, abrir las señales y comprobar la explicación de sus límites. Seleccionar «Revisada, sin observación», introducir un comentario y guardar. La interfaz confirma que la calificación no cambia; el contrato conserva el estado, comentario y correcciones anteriores. [Captura de la revisión](visibilidad-revision.png).
8. Archivar la materia ficticia, conservándola en su ventana normal de recuperación. No se purgaron datos ajenos.

## Alcance

El [registro JSON](visibilidad-aviso-datos-minimos.json) contiene los resultados, fecha real y huella del componente. Los identificadores de preparación y sesiones permanecen privados. El primer ejecutor esperaba una lista de eventos dentro del intento; el contrato utiliza un conteo en la incidencia docente. Se corrigió esa expectativa del ejecutor, sin modificar el producto.

Se completan conjuntamente el aviso, los datos mínimos y la revisión sin sanción automática de AP-27. Sigue pendiente comprobar la emisión real de `visibilitychange` con una pestaña de navegador en condiciones normales. También siguen pendientes otros navegadores y dispositivos físicos. Esta evidencia no demuestra detección de trampas.
