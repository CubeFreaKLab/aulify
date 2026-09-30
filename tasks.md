# Tareas de desarrollo de Aulify

**Estado: base funcional 1.0, modelo 1.3 e implementación integrada con Supabase disponibles. T-02 documental completada; la verificación de entrega y operación sigue abierta.**

Las tareas se apoyan en [specification.md](specification.md) y [plan.md](plan.md). La existencia de estos documentos no acredita funciones implementadas. Resolver las decisiones que afecten una tarea antes de iniciar su construcción.

La [entrega 001](specs/001-recurso-interactivo/spec.md) concreta parte del recorrido central. Su [desglose de tareas](specs/001-recurso-interactivo/tasks.md) desarrolla la secuencia de modelado, diseño, acceso, materias, recursos, participación y evaluación. T-02 se cierra como definición documental mediante la especificación general 1.0 y las decisiones D-01 a D-07. No acredita implementación ni pruebas ejecutadas.

## Preparación técnica

La integración conecta las pantallas a Supabase con permisos y archivos reales. Al corte del 30 de septiembre UTC hay veintitrés migraciones locales y remotas; la última es `20260930051014_aulify_completion_grade_existence.sql`, con [detección de revisión pendiente mediante existencia de calificaciones](docs/verificacion/completitud-existencia.md). Se conservan por revisión las [84 verificaciones anteriores de SQL aislado](docs/verificacion/datos-regresion-proyeccion-estudiante.json), [45 remotas iniciales](docs/verificacion/datos-remotos.md), [concurrencia guiada](docs/verificacion/datos-carrera-guiada.md) y [recorridos de navegador](docs/verificacion/integracion-web.md), junto a las correcciones posteriores de [editor](docs/diseno/revision-biblioteca-editor-2026-09-29.md) y [pantallas móviles](docs/diseno/revision-pantallas-2026-09-29.md). T-03 y T-05 tienen implementación ejecutada; su evidencia se conserva por capa. T-01/T-06 siguen parcialmente abiertas por SMTP, T-20 por carga y T-21 por despliegue y operación. Las tareas mantienen sus criterios completos y no se cierran mediante el conteo de pruebas.

El [CI 36669578313](https://github.com/CubeFreaKLab/aulify/actions/runs/36669578313) aprobó `1194382`, con veintidós migraciones, 151 pruebas y 88 recorridos de Chromium sin reintentos; las 24 ejecuciones autenticadas omitidas tienen evidencia independiente. El [ensayo individual completo](docs/verificacion/carga-individual-20260930.md) conservó respuestas, pero incumplió latencia y falló al leer algunos resultados. El modo guiado quedó sin ejecutar. Los resultados históricos se conservan por revisión y los criterios de liberación continúan abiertos.

El candidato `27e4df6` tiene CI aprobado con 157 pruebas y 88 recorridos, además de una [vista previa HTTPS comprobada](docs/verificacion/vista-previa-https.md). Se verificaron acceso de ambos roles, persistencia de borrador y resultados estudiantiles. Esto aporta evidencia a T-21; no cierra producción, correo ni capacidad. El [diagnóstico de 128 conexiones](docs/verificacion/diagnostico-transporte-128.md) terminó sin fallos, pero incumplió la latencia objetivo. La [reserva posterior de conexiones](docs/verificacion/conexiones-reservadas.md), `1e4160b`, tiene CI con 159 pruebas y 88 recorridos: su ráfaga de 200 respuestas conserva integridad, pero p95 de 3.290,33 ms. T-20 permanece abierta. La Preview vigente ya contiene `f9a7013`, con CI de 162 pruebas unitarias y 88 recorridos, persistencia y acceso de ambos roles comprobados y el texto de cierre guiado corregido; producción sigue pendiente.

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-01 | Comprobar Supabase Free, despliegue, correo y acceso privado a datos y archivos | RF-01, RF-02, RF-10, RNF-03, RNF-04 | — | Prueba con cuentas ficticias, RLS y Storage comprobados, recuperación por SMTP y transporte de sincronización evaluados frente a cuotas y carga objetivo. |
| T-02 | Definir reglas de evaluación, estados y visibilidad (documentación completada) | RF-05 a RF-08, RF-13 a RF-16 | — | Base 1.0, D-01 a D-07, casos AC-01 a AC-38 y AP-01 a AP-38 con resultados esperados. |
| T-03 | Definir modelo relacional de PostgreSQL, normalización, permisos, consultas y versiones | RF-01 a RF-17 | T-02 para el modelo; T-01 para validar persistencia | Modelo 1.3 y documentación en [modelado](docs/modelado/README.md), veintitrés migraciones aplicadas. La [proyección estudiantil](docs/verificacion/datos-proyeccion-actividad-estudiante-remota.md) conserva contenido y permisos tras eliminar trabajo duplicado. La [proyección docente](docs/verificacion/datos-proyeccion-revisiones-docente.md) conserva el helper privado: 23 comprobaciones específicas y 84 de regresión locales; cincuenta intentos remotos equivalentes antes/después, 119.037 bytes. Consolidar cobertura de todos los escenarios; no acredita capacidad. |
| T-04 | Diseñar recorridos principales en celular y computadora | RNF-01, RNF-02, RF-16 | T-02 | Pantallas y estados de crear, publicar, participar, entregar y revisar; controles accesibles y configuración avanzada. |
| T-05 | Inicializar aplicación, Playwright e integración continua con GitHub Actions | RNF-01, RNF-02, RNF-04 | T-01, T-03 | Dependencias fijadas, construcción reproducible y configuración de ejemplo sin secretos. Flujo de Actions ejecutado con análisis estático, tipos, pruebas disponibles, construcción y recorrido inicial de Playwright; registrar informe y entorno aislado para pruebas de datos. |

## Recorrido central

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-06 | Implementar registro, acceso, recuperación y permisos | RF-01 | T-05 | Cada rol completa el acceso; operaciones y datos ajenos permanecen restringidos. [Quince comprobaciones de Auth/API](docs/verificacion/acceso-sin-confirmar.md) verifican el bloqueo sin correo confirmado en ambos roles; formulario, SMTP, confirmación y recuperación por correo pendientes. |
| T-07 | Implementar materias e ingreso por código con aprobación | RF-02 | T-06 | Crear dos materias, aprobar solicitudes y comprobar separación de integrantes y resultados. |
| T-08 | Construir editor por bloques, borrador y publicación | RF-03 | T-04, T-07 | Crear y recuperar un borrador, reordenar con teclado o táctil, previsualizar y publicar. |
| T-09 | Implementar biblioteca, copias y versiones | RF-04 | T-08 | Una copia se edita por separado y los intentos existentes conservan el contenido utilizado. |
| T-10 | Construir tipos de pregunta y reglas de corrección | RF-07, RF-13 | T-02, T-09 | Casos por tipo con puntuación esperada; toda respuesta escrita queda para revisión manual. |
| T-11 | Implementar disponibilidad, avance y reconexión | RF-05, RF-14, RF-15 | T-10 | Sesión guiada e individual, mezcla coherente, reconexión al mismo intento y cierre por plazo sin duplicaciones. |
| T-12 | Incorporar configuración principal, avanzada y resumen | RF-16 | T-04, T-11 | Las reglas activas son comprensibles antes de iniciar y las combinaciones disponibles son coherentes. |

## Evaluación y seguimiento

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-13 | Implementar tareas con archivos y reentregas | RF-10 | T-01, T-07 | Acceso privado, reemplazo antes del cierre y reentrega autorizada con versiones conservadas. |
| T-14 | Implementar revisión manual, publicación y promedio | RF-07, RF-08, RF-11 | T-10, T-13 | Notas propias publicadas, pendientes excluidos, actividad manual y promedio con resultados verificables. |
| T-15 | Implementar equipos, clasificación y potenciadores | RF-06, RF-07, RF-15 | T-02, T-11, T-14 | Un uso de cada potenciador por actividad, tope de nota, clasificación por equipos y visibilidad respetados. [AP-12 remoto](docs/verificacion/pistas-concurrentes-remotas.md) comprueba solicitudes de pistas distintas y consumo único; los demás escenarios conservan su estado en la matriz. |
| T-16 | Construir gráficos, tablas y filtros | RF-12 | T-14 | Mismos valores en gráficos y tablas al filtrar materia, curso y año. |
| T-17 | Implementar controles de integridad e incidencias | RF-09, RF-14 | T-03, T-11 | Intentos y permisos comprobados; señales documentadas y sin sanción automática. |
| T-18 | Implementar archivo, restauración y eliminación | RF-02 | T-03, T-09, T-13 | Restauración dentro del plazo y eliminación completa, conservando biblioteca y otras materias. [32 comprobaciones locales](docs/verificacion/conservacion-archivos-compartidos.md), [28 de concurrencia nativa](docs/verificacion/carrera-restauracion-purga.md) y [29 con Storage remoto](docs/verificacion/conservacion-storage-remota.md) verifican bytes compartidos, fallo parcial y reintento. AP-32 cubierto. La [observación programada](docs/verificacion/conservacion-programada.md) eliminó el caso preparado en 2 h 7 min 58,496 s; AP-31 mantiene pendiente la carrera remota. |
| T-22 | Implementar ayuda inicial por rol y ayuda contextual | RF-17, RNF-01, RNF-02 | T-04, T-06, T-12 | AC-31 a AC-34 y AP-34: [diez ejecuciones locales y una remota](docs/verificacion/ayuda-por-cuenta.md) cubren omitir/repetir, teclado, versión y ayuda sin efectos sobre intentos o notas. La [primera entrada posterior](docs/verificacion/ayuda-primera-entrada.md) comprueba ambos roles con Supabase real, cinco pasos y persistencia entre sesiones sobre el compilado identificado. Lector de pantalla manual pendiente. |

## Comprobación integrada

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-19 | Revisar recorridos y accesibilidad en ambos dispositivos | RNF-01, RNF-02 | T-12 a T-18, T-22 | Registro de barreras y correcciones; teclado, foco, contraste, tiempo y alternativas de interacción comprobados. |
| T-20 | Ejecutar pruebas de carga y consumo de servicios | RNF-03, RNF-04 | T-11, T-15, T-16 | Umbrales fijados antes de la ejecución; resultados de cuatro actividades de 50 estudiantes con consumo, errores y latencia. |
| T-21 | Verificar despliegue y documentar operación | RF-01 a RF-17, RNF-01 a RNF-06 | T-19, T-20 | Versión publicada, recorridos esenciales comprobados y límites, recuperación y mantenimiento documentados. |

No marcar una tarea como completada solo porque exista código. Enlazar su evidencia y actualizar la especificación cuando una decisión cambie el comportamiento previsto.

La [matriz de trazabilidad](docs/calidad/trazabilidad.md) y el [plan de calidad](docs/calidad/plan-de-calidad.md) completan los criterios y su evidencia.

La [revisión de biblioteca, editor y lector del 29 de septiembre](docs/diseno/revision-biblioteca-editor-2026-09-29.md) aporta evidencia adicional a T-04, T-08, T-09 y T-19: navegación por teclado, imágenes sin deformación, formato compartido, persistencia local y adaptación de las vistas comprobadas. La integración autenticada y los criterios completos de liberación mantienen sus comprobaciones separadas.

La [continuidad guiada](docs/verificacion/guiada-continuidad.md) añade evidencia a T-11/T-12: AP-09/AP-10 comprobados en escritorio y móvil con Supabase, aviso de confirmación conservado y cierre con revisión manual pendiente. Se mantiene la capacidad y la operación como tareas abiertas; estos recorridos no son una carga sostenida.

La [reutilización y configuración](docs/verificacion/reutilizacion-y-configuracion.md) comprueba AP-01/AP-02 y completa la explicación de AP-15: copia entre materias con historial intacto, lectura sin nota, quiz independiente y opciones de ocultamiento comprensibles. Aporta evidencia a T-09/T-12 en escritorio y móvil; las comprobaciones remotas y de demostración se distinguen en el informe.
