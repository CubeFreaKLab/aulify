# Trazabilidad de requisitos, tareas y comprobaciones

Base funcional 1.0 · actualización del 28 de septiembre de 2026. Existen verificaciones aisladas, remotas y de navegador de la integración; la correspondencia individual de los 76 escenarios AC/AP se está consolidando. Consulta [estado](../estado-del-desarrollo.md) e [integración web](../verificacion/integracion-web.md). No convertir un conteo de pruebas en aprobación automática de estos casos.

Esta matriz enlaza el [catálogo de requisitos y sus reglas](../../specification.md), las [tareas](../../tasks.md), los [casos AC de la entrega 001](../../specs/001-recurso-interactivo/aceptacion.md) y los [casos AP del alcance completo](../../specs/aceptacion-producto.md). Los criterios Q pertenecen al [plan de calidad](plan-de-calidad.md). Aquí «AC» identifica casos de aceptación; en la columna de reglas se escribe «regla AC» para distinguir las reglas de participación del documento general.

La relación es de cobertura prevista, no de prueba aprobada. Un caso puede comprobar varios requisitos; no contar esa repetición como varias ejecuciones independientes. Los 38 casos AC y 38 casos AP constituyen 76 escenarios definidos. Cada uno se desglosará en pasos y datos reproducibles cuando existan contratos e interfaz.

| Requisito | Reglas principales | Tareas responsables | Casos previstos | Evidencia que se conservará |
|---|---|---|---|---|
| RF-01 · Cuentas | CU-01, CU-06 | T-01, T-06 | AC-01 a AC-03, AC-06 | Acceso y recuperación con cuentas ficticias; rechazo de operaciones ajenas. |
| RF-02 · Materias y pertenencia | CU-02 a CU-06; IN-04 a IN-07 | T-07, T-18 | AC-04 a AC-06; AP-29 a AP-32, AP-37 | Solicitudes, permisos, retiro, restauración, purga y referencias conservadas. |
| RF-03 · Editor por bloques | RE-02, RE-03, RE-06 | T-08 | AC-07 a AC-09, AC-28, AC-35; AP-33 | Borrador recuperado, conflicto controlado, publicación válida y operación por teclado. |
| RF-04 · Biblioteca y versiones | RE-01, RE-02, RE-04, RE-05 | T-09 | AC-10, AC-11, AC-35, AC-36; AP-01, AP-02 | Copias independientes, versión inmutable y prueba de operaciones concurrentes. |
| RF-05 · Participación y tiempo | Reglas AC-01 a AC-09 | T-11, T-12 | AC-12 a AC-20, AC-36; AP-09, AP-10 | Recorridos individual/guiado, plazos, intentos, reconexión y cierre. |
| RF-06 · Juego y equipos | JU-03 a JU-08; EV-01 | T-15 | AP-11 a AP-20 | Consumo único, cálculos, empate, equipos y visibilidad permitida. |
| RF-07 · Corrección y puntuación | PR-01, PR-02; EV-01 a EV-04 | T-10, T-14, T-15 | AC-15, AC-19, AC-21, AC-22, AC-37; AP-03 a AP-07, AP-13, AP-14 | Ejemplos calculados, límites, escritura manual, bonificación y redondeo. |
| RF-08 · Notas y promedio | EV-04 a EV-08; JU-01 | T-14 | AC-22 a AC-26, AC-38; AP-15, AP-16, AP-24, AP-25 | Publicación por estudiante, historial y promedio con pendientes y ceros explícitos. |
| RF-09 · Integridad e incidencias | IN-01 a IN-03, IN-06, IN-07 | T-17 | AC-06, AC-16 a AC-20; AP-27 a AP-29 | Operaciones rechazadas, señales limitadas y resolución sin sanción automática. |
| RF-10 · Tareas con archivos | TA-01 a TA-03 | T-13 | AP-21 a AP-24 | Archivos privados, límites, plazos y versiones de entrega/evaluación. |
| RF-11 · Evaluación manual | TA-04; EV-05 a EV-08 | T-14 | AP-25, AP-26 | Notas individuales publicadas e historial sin entregas ficticias. |
| RF-12 · Seguimiento | SE-01 a SE-03; EV-08 | T-16 | AP-26, AP-38 | Gráficos y tablas equivalentes; filtros, pendientes y límites de intervalos. |
| RF-13 · Tipos de preguntas | PR-01, PR-02 | T-10 | AC-09, AC-14, AC-15; AP-03 a AP-07 | Creación, presentación y corrección por tipo con valores esperados. |
| RF-14 · Mezcla | PR-03, PR-04; IN-01 | T-11, T-17 | AC-17; AP-08, AP-09 | Orden persistido, grupos dependientes y restricciones del modo guiado. |
| RF-15 · Retroalimentación | Reglas AC-04, AC-05; JU-01 a JU-03 | T-11, T-15 | AC-13 a AC-16, AC-26; AP-15 a AP-18 | Transiciones, manejo de errores y ausencia de soluciones/puntos reservados. |
| RF-16 · Configuración | Regla AC-01; RE-05 | T-12 | AC-12, AC-20, AC-36; AP-15, AP-20 | Resumen comprensible, opciones compatibles y bloqueo de reglas iniciadas. |
| RF-17 · Ayuda | AY-01 a AY-04 | T-22 | AC-31 a AC-34; AP-34 | Guía por rol, omisión/repetición, preferencia persistente y accesibilidad. |
| RNF-01 · Adaptación | Q-02 | T-04, T-19, T-22 | AC-27, AC-28, AC-33; AP-38 | Capturas con tamaño/navegador y comprobación de acciones y reflujo. |
| RNF-02 · Usabilidad y accesibilidad | Q-02, Q-03, Q-07 | T-04, T-19, T-22 | AC-27 a AC-34; AP-17, AP-33, AP-38 | Revisión automática/manual y tareas con participantes reales; resultados separados. |
| RNF-03 · Capacidad | Q-04, Q-06 | T-01, T-20 | AP-35 | Carga reproducible de 204 sesiones, latencia, errores y persistencia. |
| RNF-04 · Servicios gratuitos | Q-09 | T-01, T-20, T-21 | AP-35, AP-36 | Planes elegibles, cuotas y consumo medido sin activar facturación. |
| RNF-05 · Privacidad y autorización | IN-01 a IN-07; Q-04, Q-05 | T-03, T-06, T-13, T-17, T-18 | AC-03, AC-06, AC-10, AC-11, AC-16, AC-26; AP-15, AP-20 a AP-24, AP-27 a AP-33, AP-37 | Matriz de acceso, RLS/archivos, concurrencia, ocultamiento y eliminación. |
| RNF-06 · Reproducibilidad | Q-01, Q-08 | T-03, T-05, T-21 | AP-31, AP-36; ejecuciones de los casos de la entrega | Migraciones, informe real de CI, respaldo/recuperación y documentación de operación. |

## Registro por ejecución

| Campo | Qué registrar |
|---|---|
| Identificación | ID de ejecución, caso AC/AP, requisito, tarea y versión del spec. |
| Versión y entorno | Commit, fecha real, dependencias, configuración, navegador/dispositivo o servicio relevante. |
| Preparación | Datos ficticios, estado inicial, permisos y dependencias disponibles. |
| Procedimiento | Pasos/comando reproducibles y resultado esperado vigente. |
| Resultado | Observado, aprobado/fallido/bloqueado/no ejecutado, mediciones y limitaciones. |
| Evidencia | Informe, captura, traza o consulta que respalde el resultado; sin datos privados. |
| Seguimiento | Defecto, corrección y nueva ejecución vinculados; conservar el fallo original. |

El [modelo de datos 1.0](../modelado/README.md) ya está disponible. Los vínculos siguientes son evidencia de diseño documental; las migraciones todavía no existen. Las fuentes editables y el commit permiten reproducir las figuras.

| Requisitos | Modelo disponible |
|---|---|
| RF-01, RF-02, RF-17 | [Identidad y pertenencia](../modelado/diagramas/01-identidad.svg): perfiles, códigos, solicitudes, membresías, eventos y ayuda. |
| RF-03, RF-04, RF-13, RF-14 | [Autoría](../modelado/diagramas/02-autoria.svg): borrador, versiones, bloques, grupos, preguntas, elementos y secretos. |
| RF-05, RF-16 | [Actividades](../modelado/diagramas/03-actividades.svg): subtipos, participantes, plazos y sesión guiada. |
| RF-05, RF-06, RF-14, RF-15 | [Participación](../modelado/diagramas/04-participacion.svg): intentos, orden, respuestas, equipos y consumos. |
| RF-07, RF-08, RF-10, RF-11, RF-12 | [Evaluación](../modelado/diagramas/05-evaluacion.svg): revisiones, entregas y publicaciones; gráficos y promedios se derivan. |
| RF-02, RF-09, RNF-05, RNF-06 | [Operación](../modelado/diagramas/06-operacion.svg) y [permisos](../modelado/permisos.md): incidencias, conservación e invariantes. |
| RNF-01, RNF-02, RNF-03, RNF-04 | [Casos y estados](../modelado/casos-y-operaciones.md) para diseñar la experiencia; rendimiento, usabilidad, accesibilidad y consumo siguen pendientes de medición. |

## Cambios y finalización

### Evidencia del prototipo 0.1.0

| Requisitos relacionados | Comprobación disponible | Límite |
|---|---|---|
| RF-03, RF-04, RF-13 | Guardado de bloques enriquecidos, recarga, ordenación por teclado, copias y versiones; ocho tipos de pregunta. | Adaptador local, sin persistencia ni autorización de servidor. |
| RF-05, RF-06, RF-07, RF-08, RF-14, RF-15, RF-16 | Recorrido de publicación, participación, revisión manual y nota; ayudas de un uso, corrección oculta y sesión guiada. | La sala comparte almacenamiento entre pestañas; no acredita sincronización remota ni equipos. |
| RF-10, RF-12, RF-17 | Metadatos de entregas, revisión, filtros y tabla/gráfico; ayuda por rol sin consumir intentos. | No almacena bytes de archivos; falta almacenamiento privado y evaluación con usuarios. |
| RNF-01, RNF-02 | Playwright en escritorio y móvil emulado; teclado, foco, movimiento reducido, reflujo y análisis axe en estados identificados. | No certifica WCAG completo ni reemplaza pruebas con lectores de pantalla o teléfonos físicos. |
| RNF-06 | Dependencias fijadas, construcción y flujo de GitHub Actions con informe por versión. | CI no despliega ni comprueba migraciones o recuperación de datos. |

Procedimientos, versiones y resultados en [pruebas del prototipo](../verificacion/pruebas-prototipo.md). Estos casos de demostración no se contabilizan como aprobaciones de los 76 escenarios integrados.

Si cambia una regla, actualizar su caso y esta matriz antes de implementar. Al terminar una tarea, registrar qué casos se ejecutaron, cuáles faltan y dónde están sus resultados. La comprobación de enlaces o de este documento acredita coherencia documental, no funcionamiento del producto. El estado consolidado se conserva en [estado del desarrollo](../estado-del-desarrollo.md).
