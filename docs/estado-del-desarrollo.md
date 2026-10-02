# Estado del desarrollo

Actualizado el 2 de octubre de 2026. Aulify funciona con una aplicación compilada local, Supabase y verificaciones registradas. La publicación y los criterios completos de liberación siguen pendientes.

## Versión y servicios

- Modelo relacional 1.3: 47 tablas, 295 campos y 78 relaciones. Veinticinco migraciones locales y remotas; la última es `20261002221000_aulify_scoped_purge_retry.sql`. Las dos nuevas corrigen el orden de grupos dependientes y acotan reintentos de eliminación, sin cambiar tablas ni relaciones.
- Compilado local vigente: `DbIsroXTuSqh8Ui1zOamx`, aplicación pública de `4fa2c2d`; los cambios posteriores añaden pruebas, funciones SQL y operación. La Preview permanece en `4fa2c2d`, protegida. Los compilados anteriores de los informes conservan su propia evidencia.
- Último CI comprobado: [37072714791](https://github.com/CubeFreaKLab/aulify/actions/runs/37072714791), aprobado sobre `3fae008`, incluidas las migraciones 24/25 y el reintento por trabajo. Los pasos aprobados se conservan en [ci-cierre-20261002.json](verificacion/ci-cierre-20261002.json); las pruebas remotas ejecutadas localmente mantienen evidencia separada.
- Supabase continúa en Free. El [registro de cuotas](verificacion/cuotas-supabase-20260929.md) distingue consumo mostrado y estimaciones del ejecutor.
- Vercel Hobby tiene una [vista previa HTTPS verificada](verificacion/vista-previa-https.md), protegida con Vercel Authentication. Ambos roles acceden a Supabase y el borrador docente persiste al recargar. El [procedimiento de despliegue](operacion/despliegue.md) distingue esta comprobación de la liberación de producción, aún pendiente.

`/demo` ofrece una clase ficticia en el navegador. `/aula` exige sesión de Supabase y utiliza operaciones autorizadas de PostgreSQL y archivos privados de Storage.

## Verificaciones del cierre técnico

La [comprobación conjunta](verificacion/aceptacion-combinada.md) completa contratos remotos de mezcla/reconexión, equipos, notas manuales, retiro/readmisión y límite/renovación de códigos. Detectó y corrigió la separación de preguntas dependientes mediante la migración 24. La [secuencia de archivos](verificacion/entregas-secuencia.md) comprobó límites combinados, carga incompleta, reemplazo, permisos de reentrega y republicación de notas con Storage real. La [racha con revisión manual](verificacion/racha-revision-manual.md) aprobó dos ejecuciones de demostración en escritorio y móvil emulado.

La migración 25 incorpora un reintento administrativo limitado a un trabajo. [Quince comprobaciones aisladas y dieciséis remotas](verificacion/purga-acotada.md) cubren permisos, solicitudes concurrentes de restauración y purga, fallo parcial e idempotencia sin afectar otras materias. Conservan fechas sintéticas y distinguen la caché del origen. El plazo programado mantiene la observación anterior.

El [respaldo de Storage](operacion/respaldo.md) copió 42 objetos y verificó 22.024.706 bytes por hashes en una carpeta privada. No sustituye la restauración integral de PostgreSQL, Auth y archivos; falta la conexión de base de datos y un destino aislado. El ejecutor completo de carga ya admite la Preview autorizada; todavía no se ha realizado esa medición y Q-06/Q-09 siguen abiertos.

## Actualización de interfaz pública

El inicio y las pantallas de acceso se simplificaron. La cabecera sitúa la marca a la izquierda y los accesos a la derecha; los enlaces de demostración quedan al pie. Acceso, registro y recuperación comparten un formulario centrado sobre superficies neutras. Construcción y ESLint correctos; catorce recorridos públicos aprobados en Chromium de escritorio y móvil, incluida adaptación a 320 px. La transición circular del tema conserva la comprobación de la revisión anterior. Esta actualización no modifica autenticación, datos ni reglas académicas. El rediseño de la presentación comercial sigue pendiente.

## Funciones disponibles

- Inicio mínimo con logo y accesos en la cabecera, centro vacío y demos al pie. Tipografía Inter, un botón de tema con transición circular y preferencia inicial del sistema. Acceso y registro usan formularios centrados sin panel ilustrado. Se respeta movimiento reducido.
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
| Compilación y dominio | CI de `4cbdca3`: 162 pruebas en dieciocho archivos y construcción aprobadas; construcción local comprobada. | La Preview conserva `f9a7013`, con su propio CI y compilado. Los conteos pertenecen a sus ejecuciones y no se suman como escenarios independientes. |
| Biblioteca y configuración | [Reutilización y configuración](verificacion/reutilizacion-y-configuracion.md): AP-01/AP-02 con Supabase y explicación de AP-15 en demostración. | Cuatro ejecuciones de dos escenarios; datos ficticios, móvil emulado y app local compilada. No acredita producción. |
| Permisos e integración | [45 comprobaciones de Supabase real](verificacion/datos-remotos.md), más recorridos posteriores de [reconexión y confirmación](verificacion/integracion-resiliencia.json). | No sustituyen correo, despliegue público ni capacidad sostenida. |
| Sincronización | [Proyección acotada](verificacion/datos-proyeccion-actividad-estudiante-remota.md), [contexto de actividad](verificacion/sync-contexto-local.md) y [reintento de descarga](verificacion/sincronizacion-proyeccion-reintento.md). | Lecturas correctas y reducción de trabajo no garantizan los umbrales con 200 estudiantes. |
| Evaluación y juego | [Publicación](verificacion/juego-aceptacion.md), [revisión](verificacion/datos-revision-participante.md), [distribución](verificacion/resultados-distribucion.md), [pistas simultáneas](verificacion/pistas-concurrentes-remotas.md) y [continuidad guiada](verificacion/guiada-continuidad.md). | AP-09/AP-10 comprobados en navegador local con Supabase, escritorio/móvil; AP-12 mediante contrato remoto. Entorno, revisiones y límites separados por ensayo. |
| Ayuda y cuentas | [Ayuda por cuenta](verificacion/ayuda-por-cuenta.md), [primera entrada de ambos roles](verificacion/ayuda-primera-entrada.md) y [rechazo de cuentas sin confirmar](verificacion/acceso-sin-confirmar.md). | Primera entrada aprobada sobre el compilado local con Supabase; cuentas confirmadas administrativamente. Entrega de correo y lector de pantalla manual pendientes. |
| Conservación de señales | [Frontera de treinta días](verificacion/conservacion-senales.md): once comprobaciones locales y cuatro remotas con reversión incondicional. | Fechas de prueba sintéticas; no representa esperar treinta días reales. |
| Archivos y borrado parcial | [29 comprobaciones remotas](verificacion/conservacion-storage-remota.md): bytes y metadatos exclusivos eliminados, archivo compartido conservado y reintento idempotente. | AP-32 cubierto. El plazo programado y la carrera remota posterior de AP-31 se conservan por separado. |
| Limpieza programada | [Observación completada](verificacion/conservacion-programada.md): ejecución `schedule` 36673912107, materia y archivo eliminados en 2 h 7 min 58,496 s desde la elegibilidad; siete comprobaciones. | Antigüedad de treinta días sintética; espera del programador real. Un caso no constituye un SLA general. La carrera remota posterior se conserva en el informe de reintento por trabajo. |
| Recuperación | [Nueve comprobaciones aisladas](verificacion/recuperacion-aislada.md) con datos ficticios. | No es una restauración operativa de Supabase Auth, base de datos y Storage. |
| Accesibilidad | Recorridos de teclado, foco, reflujo y análisis axe en los lotes identificados. | No acredita conformidad completa con WCAG ni evaluación con personas. |

Los escenarios AC/AP y sus evidencias se consultan en la [matriz de trazabilidad](calidad/trazabilidad.md). El CI comprobado aprobó 162 pruebas y 90 recorridos de Chromium sin reintentos. Treinta ejecuciones autenticadas se omiten en CI y mantienen su evidencia separada; no se consideran aprobadas por omisión. Los registros descargados sustentan los recuentos.

## Rendimiento

El [diagnóstico de sesenta segundos](verificacion/transporte-acotado.md) confirmó 200 respuestas sin pérdida y obtuvo p95 de 797,21 ms. La [prueba sostenida posterior](verificacion/carga-sostenida-20260930.md) conservó 2.000 respuestas sin fallos durante cinco minutos, pero su p95 de 2.347,96 ms superó la meta de 1.500 ms. Después falló la preparación de nuevos intentos y no se ejecutaron las mediciones completas ni el modo guiado.

El ejecutor ahora separa tiempos de preparación, servicio de datos y respuesta HTTP, registra demoras por pregunta y espera las solicitudes en curso antes de informar un fallo. El [diagnóstico limitado posterior](verificacion/diagnostico-snapshot-20260930.md) conservó 2.000 respuestas, con p95 de confirmación de 1.141,10 ms y cinco fallos de lectura durante el calentamiento. Después de publicar las notas, fallaron tres de las 51 consultas de resultados iniciadas y se detuvo. PostgreSQL identifica cancelaciones en la consulta general de historial; esa ruta se corrigió después en la migración 22. La regresión HTTP posterior abrió los resultados de 200 cuentas, con concurrencia ocho, sin errores y p95 de 755,40 ms; conserva historial y calificaciones. Véase el [informe del resumen del aula](verificacion/resumen-aula-20260930.md). Esta comprobación específica no sustituye la prueba completa de capacidad. No es una aprobación de Q-06/Q-09 y se mantienen sus umbrales.

La [medición individual de quince minutos](verificacion/carga-individual-20260930.md), ya con la migración 22, conservó las 2.000 respuestas sin duplicaciones y registró 174.364 solicitudes sin fallos en esa ventana. Su p95 de confirmación fue de 2.665,11 ms, superior a la meta. Después fallaron tres de las 84 lecturas de resultados iniciadas; el modo guiado no comenzó. Q-06 y Q-09 permanecen abiertos. No se repite el ensayo completo sin una corrección justificada.

La [migración 23](verificacion/completitud-existencia.md) simplifica la detección de revisión pendiente: 32 comprobaciones específicas y 85 generales aprobadas localmente y en el CI citado; cien intentos remotos sin diferencias. Las lecturas HTTP de 24 cuentas aprobaron dos pasadas con concurrencia ocho. No modifica el envío de respuestas ni acredita capacidad sostenida.

Un [diagnóstico posterior de la cola](verificacion/cola-transporte-20260930.md), todavía con el pool de 64, se detuvo por acumulación de esperas. Conservó las 486 respuestas confirmadas y encontró otras 114 persistidas sin acuse a tiempo. El [ensayo con 128 conexiones](verificacion/diagnostico-transporte-128.md) completó cinco minutos, 59.259 solicitudes y 2.000 respuestas sin errores ni pérdida, además de publicar y consultar doscientas notas. Su p95 de confirmación fue 3.047,92 ms: sigue sin cumplir la meta. No se ejecutaron las fases de quince minutos ni el modo guiado; los criterios de liberación no cambian.

## Pendientes de liberación

La [instrumentación posterior del despacho](verificacion/diagnostico-despacho-20260930.md) identificó colas de hasta 89 comandos y 108 lecturas; conservó 200 respuestas, con p95 de confirmación de 5.096,83 ms. El tiempo SQL agregado no explica por sí solo la latencia HTTP. El entorno instrumentado sigue siendo local; Vercel ya configura sus funciones en `gru1`, cuya capacidad deberá medirse por separado con acceso autorizado.

El candidato [con conexiones reservadas](verificacion/conexiones-reservadas.md) impide que una cola de lecturas ocupe todo el cupo de comandos. Dos pruebas HTTP adicionales verifican aislamiento y cancelación. Su diagnóstico remoto completó 11.552 solicitudes sin fallos y conservó 200 respuestas, pero el p95 de confirmación fue 3.290,33 ms: no aprueba la meta. El perfil SQL aislado y la comparación de transportes se conservan por separado y tampoco acreditan Q-06. No se repite un ensayo largo sin otra corrección justificada.

1. Resolver el problema de capacidad y verificar cuatro grupos de cincuenta estudiantes con sus docentes, en ambas modalidades y dentro de las cuotas Free.
2. Conservar la evidencia de AP-31 ya comprobada por capas y completar las verificaciones manuales pendientes; no repetir la carrera sin un cambio relevante.
3. Configurar y verificar publicación por HTTPS, condiciones de CI/CD, confirmación y recuperación por correo. El dominio propio sigue fuera de esta entrega.
4. Comprobar recuperación operativa de base, cuentas y archivos; completar revisión manual de accesibilidad. La primera entrada de ambos roles ya tiene evidencia con Supabase real.
5. Consolidar documentación y manuales sobre una revisión verificable. Jira y QMetry no están configurados; los casos, incidencias y resultados existentes se mantienen en el repositorio.

La protección de Auth contra contraseñas filtradas requiere un plan de pago y permanece deshabilitada; se conserva Free y el [aviso del asesor](verificacion/asesores-supabase.json). Este aviso no representa una auditoría completa de seguridad.

El [plan técnico](../plan.md), las [tareas](../tasks.md), la [especificación](../specification.md) y el [plan de calidad](calidad/plan-de-calidad.md) conservan los requisitos. Los informes anteriores siguen disponibles como evidencia de sus versiones, sin extender sus resultados automáticamente al estado actual.
