# Estado del desarrollo

Actualizado el 30 de septiembre de 2026. Aulify funciona con una aplicación compilada local, Supabase y verificaciones registradas. La publicación y los criterios completos de liberación siguen pendientes.

## Versión y servicios

- Modelo relacional 1.3: 47 tablas, 295 campos y 78 relaciones. Veintidós migraciones locales y remotas; la última es `20260930040716_aulify_workspace_overview.sql`.
- Compilado local: `P6WDnTpFwNCt3ILdxXorb`, con la consulta general resumida de la migración 22. El historial se conserva y las preguntas completas se cargan al abrir cada actividad.
- Último CI comprobado: [36668172476](https://github.com/CubeFreaKLab/aulify/actions/runs/36668172476), aprobado sobre `569aef7`. Incluye las veintidós migraciones y el resumen del aula. No se atribuye ese resultado a revisiones posteriores. Los pasos y revisiones observados se conservan en el [registro de integración](verificacion/ci-integracion.json).
- Supabase continúa en Free. El [registro de cuotas](verificacion/cuotas-supabase-20260929.md) distingue consumo mostrado y estimaciones del ejecutor.
- Vercel Hobby tiene un proyecto preparado con variables de entorno. Todavía no hay una publicación verificada; el [procedimiento de despliegue](operacion/despliegue.md) distingue preparación, candidato y producción.

`/demo` ofrece una clase ficticia en el navegador. `/aula` exige sesión de Supabase y utiliza operaciones autorizadas de PostgreSQL y archivos privados de Storage.

## Funciones disponibles

- Landing ilustrada, tipografía Inter, temas claro, oscuro y del sistema, y movimiento reducido.
- Acceso con correo y contraseña, sesión protegida, salida y limpieza de datos de la cuenta anterior. Registro y recuperación tienen formularios y endpoints; su envío general depende de SMTP.
- Materias con curso y año, código renovable, solicitud y aprobación, retiro, archivo y restauración durante treinta días.
- Biblioteca y editor por bloques con borradores, detección de conflictos, vista previa, lectura y versiones publicadas independientes. Incluye imágenes privadas, encabezados, listas, tareas, desplegables, tablas, código, enlaces y preguntas.
- Ocho tipos de pregunta, práctica y examen, avance individual o guiado, intentos y plazos de servidor, respuestas definitivas e idempotencia. Pista y doble con consumo único, sonidos opcionales, rachas, equipos y clasificación configurable.
- Tareas con archivos reales, comprobación de tipo y tamaño, reentrega autorizada y versiones conservadas. Evaluación manual y publicación separadas; los pendientes no se convierten automáticamente en cero.
- Resultados propios, promedio ponderado, filtros y distribución docente por actividad, con tablas equivalentes. Las incidencias de visibilidad de pestaña requieren revisión docente y no producen sanción automática.
- Ayuda de cinco pasos por rol, opcional y reabrible, con progreso por cuenta y versión. Durante un intento se presenta ayuda estática sin alterar el reloj.

## Diseño e interacción

La [revisión del editor y los temas](diseno/revision-editor-apariencia-2026-09-29.md) simplifica el espacio de trabajo, corrige superficies oscuras y ajusta las ilustraciones. La [revisión de biblioteca y lector](diseno/revision-biblioteca-editor-2026-09-29.md) incorpora navegación móvil con foco, muestras del contenido, imágenes ajustables sin deformación, video con carga explícita y formato compartido entre edición y lectura.

Se conservan dieciocho capturas de escritorio y móvil en ambos temas. La [segunda revisión de pantallas](diseno/revision-pantallas-2026-09-29.md) cubre materia, revisión, resultados y quiz mediante seis casos de adaptación aprobados sobre su compilado identificado. La [verificación entre motores](verificacion/compatibilidad-editor-navegacion.md) añade Firefox y WebKit para editor y navegación. Estos resultados no acreditan aceptación estética ni pruebas de usabilidad con personas.

Figma reúne veintidós vistas, cinco composiciones de ayuda y un catálogo de componentes editables. Son estados estáticos con texto, vectores, componentes y variables; no se presenta como un prototipo interactivo completo. La [sincronización de biblioteca](diseno/revision-biblioteca-figma-2026-09-29.md) describe el alcance y conserva sus referencias.

## Verificaciones y límites

| Área | Evidencia disponible | Límite de la conclusión |
|---|---|---|
| Compilación y dominio | Último lote local: 151 pruebas en diecisiete archivos y construcción aprobadas; integración continua con revisión exacta. | Los conteos pertenecen a sus ejecuciones; no se suman como escenarios independientes. |
| Permisos e integración | [45 comprobaciones de Supabase real](verificacion/datos-remotos.md), más recorridos posteriores de [reconexión y confirmación](verificacion/integracion-resiliencia.json). | No sustituyen correo, despliegue público ni capacidad sostenida. |
| Sincronización | [Proyección acotada](verificacion/datos-proyeccion-actividad-estudiante-remota.md), [contexto de actividad](verificacion/sync-contexto-local.md) y [reintento de descarga](verificacion/sincronizacion-proyeccion-reintento.md). | Lecturas correctas y reducción de trabajo no garantizan los umbrales con 200 estudiantes. |
| Evaluación y juego | [Publicación y participación](verificacion/juego-aceptacion.md), [revisión docente](verificacion/datos-revision-participante.md) y [distribución de resultados](verificacion/resultados-distribucion.md). | Se conserva el entorno y versión de cada ensayo. |
| Ayuda y cuentas | [Ayuda por cuenta](verificacion/ayuda-por-cuenta.md) y [rechazo de cuentas sin confirmar](verificacion/acceso-sin-confirmar.md). | Primera entrada completa de ambos roles, entrega de correo y lector de pantalla manual pendientes. |
| Conservación de señales | [Frontera de treinta días](verificacion/conservacion-senales.md): once comprobaciones locales y cuatro remotas con reversión incondicional. | Fechas de prueba sintéticas; no representa esperar treinta días reales. |
| Archivos y borrado parcial | [29 comprobaciones remotas](verificacion/conservacion-storage-remota.md): bytes y metadatos exclusivos eliminados, archivo compartido conservado y reintento idempotente. | AP-32 cubierto. El plazo programado y la carrera remota de AP-31 se comprueban por separado. |
| Limpieza programada | Dos ejecuciones con evento `schedule` aprobadas; una [observación de eliminación](verificacion/conservacion-programada.md) está preparada. | Activación automática no equivale a demostrar el plazo del archivo preparado; no ejecutar mantenimiento manual durante esa observación. |
| Recuperación | [Nueve comprobaciones aisladas](verificacion/recuperacion-aislada.md) con datos ficticios. | No es una restauración operativa de Supabase Auth, base de datos y Storage. |
| Accesibilidad | Recorridos de teclado, foco, reflujo y análisis axe en los lotes identificados. | No acredita conformidad completa con WCAG ni evaluación con personas. |

Los escenarios AC/AP y sus evidencias se consultan en la [matriz de trazabilidad](calidad/trazabilidad.md). Veintidós recorridos autenticados se omiten en CI y mantienen su evidencia de ejecución separada; no se consideran aprobados por omisión.

## Rendimiento

El [diagnóstico de sesenta segundos](verificacion/transporte-acotado.md) confirmó 200 respuestas sin pérdida y obtuvo p95 de 797,21 ms. La [prueba sostenida posterior](verificacion/carga-sostenida-20260930.md) conservó 2.000 respuestas sin fallos durante cinco minutos, pero su p95 de 2.347,96 ms superó la meta de 1.500 ms. Después falló la preparación de nuevos intentos y no se ejecutaron las mediciones completas ni el modo guiado.

El ejecutor ahora separa tiempos de preparación, servicio de datos y respuesta HTTP, registra demoras por pregunta y espera las solicitudes en curso antes de informar un fallo. El [diagnóstico limitado posterior](verificacion/diagnostico-snapshot-20260930.md) conservó 2.000 respuestas, con p95 de confirmación de 1.141,10 ms y cinco fallos de lectura durante el calentamiento. Después de publicar las notas, fallaron tres de las 51 consultas de resultados iniciadas y se detuvo. PostgreSQL identifica cancelaciones en la consulta general de historial; esa ruta se corrigió después en la migración 22. La regresión HTTP posterior abrió los resultados de 200 cuentas, con concurrencia ocho, sin errores y p95 de 755,40 ms; conserva historial y calificaciones. Véase el [informe del resumen del aula](verificacion/resumen-aula-20260930.md). Esta comprobación específica no sustituye la prueba completa de capacidad. No es una aprobación de Q-06/Q-09 y se mantienen sus umbrales.

## Pendientes de liberación

1. Resolver el problema de capacidad y verificar cuatro grupos de cincuenta estudiantes con sus docentes, en ambas modalidades y dentro de las cuotas Free.
2. Completar la observación programada y la carrera remota de restauración/purga de AP-31.
3. Configurar y verificar publicación por HTTPS, condiciones de CI/CD, confirmación y recuperación por correo. El dominio propio sigue fuera de esta entrega.
4. Comprobar recuperación operativa de base, cuentas y archivos; completar revisión manual de accesibilidad y primera entrada de ambos roles.
5. Consolidar documentación y manuales sobre una revisión verificable. Jira y QMetry no están configurados; los casos, incidencias y resultados existentes se mantienen en el repositorio.

La protección de Auth contra contraseñas filtradas requiere un plan de pago y permanece deshabilitada; se conserva Free y el [aviso del asesor](verificacion/asesores-supabase.json). Este aviso no representa una auditoría completa de seguridad.

El [plan técnico](../plan.md), las [tareas](../tasks.md), la [especificación](../specification.md) y el [plan de calidad](calidad/plan-de-calidad.md) conservan los requisitos. Los informes anteriores siguen disponibles como evidencia de sus versiones, sin extender sus resultados automáticamente al estado actual.
