# Tareas de desarrollo de Aulify

**Estado: planificación. Todas las tareas de implementación están pendientes.**

Las tareas se apoyan en [specification.md](specification.md) y [plan.md](plan.md). La existencia de estos documentos no acredita funciones implementadas. Resolver las decisiones que afecten una tarea antes de iniciar su construcción.

## Preparación técnica

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-01 | Comprobar despliegue gratuito y acceso privado a datos y archivos | RF-01, RF-02, RF-10, RNF-04 | — | Prueba mínima con cuentas ficticias, permisos comprobados, cuotas y elección de proveedores registradas. |
| T-02 | Precisar reglas de evaluación, estados y visibilidad pendientes | RF-05 a RF-08, RF-13 a RF-16 | — | Ejemplos de resultado esperado, fórmula y transiciones coherentes en la especificación. |
| T-03 | Definir modelo de datos, permisos, consultas y versiones | RF-01 a RF-16 | T-01, T-02 | Esquema y operaciones documentados; ninguna lectura estudiantil expone soluciones ocultas o notas ajenas. |
| T-04 | Diseñar recorridos principales en celular y computadora | RNF-01, RNF-02, RF-16 | T-02 | Pantallas y estados de crear, publicar, participar, entregar y revisar; controles accesibles y configuración avanzada. |
| T-05 | Inicializar aplicación y verificaciones del repositorio | RNF-04 | T-01, T-03 | Dependencias fijadas, construcción reproducible, configuración de ejemplo sin secretos y comprobaciones básicas. |

## Recorrido central

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-06 | Implementar registro, acceso, recuperación y permisos | RF-01 | T-05 | Cada rol completa el acceso; operaciones y datos ajenos permanecen restringidos. |
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
| T-15 | Implementar equipos, clasificación y potenciadores | RF-06, RF-07, RF-15 | T-02, T-11, T-14 | Un uso de cada potenciador por actividad, tope de nota, clasificación por equipos y visibilidad respetados. |
| T-16 | Construir gráficos, tablas y filtros | RF-12 | T-14 | Mismos valores en gráficos y tablas al filtrar materia, curso y año. |
| T-17 | Implementar controles de integridad e incidencias | RF-09, RF-14 | T-03, T-11 | Intentos y permisos comprobados; señales documentadas y sin sanción automática. |
| T-18 | Implementar archivo, restauración y eliminación | RF-02 | T-03, T-09, T-13 | Restauración dentro del plazo y eliminación completa de datos de prueba vencidos, conservando biblioteca y otras materias. |

## Comprobación integrada

| ID | Tarea | Requisitos | Depende de | Evidencia para completar |
|---|---|---|---|---|
| T-19 | Revisar recorridos y accesibilidad en ambos dispositivos | RNF-01, RNF-02 | T-12 a T-18 | Registro de barreras y correcciones; teclado, foco, contraste, tiempo y alternativas de interacción comprobados. |
| T-20 | Ejecutar pruebas de carga y consumo de servicios | RNF-03, RNF-04 | T-11, T-15, T-16 | Umbrales fijados antes de la ejecución; resultados de cuatro actividades de 50 estudiantes con consumo, errores y latencia. |
| T-21 | Verificar despliegue y documentar operación | RF-01 a RF-16, RNF-01 a RNF-04 | T-19, T-20 | Versión publicada, recorridos esenciales comprobados y límites, recuperación y mantenimiento documentados. |

No marcar una tarea como completada solo porque exista código. Enlazar su evidencia y actualizar la especificación cuando una decisión cambie el comportamiento previsto.
