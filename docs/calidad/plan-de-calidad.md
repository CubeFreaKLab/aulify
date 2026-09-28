# Plan de calidad y evidencia

Versión 1.0 · criterios del 26 de septiembre de 2026; estado actualizado el 28 de septiembre. Existen pruebas aisladas, remotas y de navegador ejecutadas. Carga, correo, operación y cobertura completa se cierran con sus resultados específicos; los umbrales siguientes se mantienen.

## Propósito

Comprobar los requisitos de [Aulify](../../specification.md) mediante pruebas reproducibles y revisión de la experiencia. El plan distingue prevención, verificación y mejora: definir criterios antes de construir, ejecutar comprobaciones, registrar defectos, corregir y repetir los casos afectados.

ISO/IEC 25010:2023 se usa como referencia para organizar atributos pertinentes, no como certificación. La accesibilidad se evalúa frente a criterios A y AA aplicables de WCAG 2.2; una biblioteca o un informe automático aislado no acreditan conformidad.

## Criterios y medidas

| ID | Área | Objetivo definido para comprobar | Evidencia |
|---|---|---|---|
| Q-01 | Funcionalidad | Todos los casos obligatorios de la entrega satisfacen su resultado esperado. Sin exposición de notas/soluciones, errores de cálculo o pérdida de respuestas confirmadas. | Casos ejecutados y fallos, relacionados con requisito y commit. |
| Q-02 | Interacción | Recorridos de crear, publicar, participar y revisar en 360 × 800 y 1440 × 900; reflujo a 320 píxeles CSS y texto al 200 %, sin perder acciones esenciales. | Capturas y registros por navegador/tamaño. |
| Q-03 | Accesibilidad | Teclado sin trampas, foco visible/no oculto, nombres y roles, errores identificados, contraste aplicable, alternativas a arrastrar, ajuste de tiempo y reducción de movimiento. Sin barreras críticas o graves abiertas en recorridos esenciales. | Revisión manual, comprobación con lector de pantalla e informe automático revisado. |
| Q-04 | Integridad | Ninguna respuesta confirmada perdida; reintentos no duplican puntos, respuestas o potenciadores. Versiones y evaluaciones publicadas no cambian silenciosamente. | Pruebas de concurrencia, desconexión y persistencia. |
| Q-05 | Autorización | Todo acceso a materia, borrador, solución, nota o archivo ajeno del catálogo negativo es rechazado. Las claves administrativas no llegan al cliente. | Pruebas de servidor, RLS y almacenamiento con varios roles. |
| Q-06 | Rendimiento | Bajo el escenario de carga definido: p95 de confirmación de respuesta ≤ 1,5 s; p95 de propagación de pregunta guiada ≤ 2 s; solicitudes válidas con fallo técnico < 1 %; cero pérdida/duplicación de respuestas confirmadas. | Mediciones con entorno, tráfico, versión, errores y consumo. |
| Q-07 | Usabilidad | En una evaluación de tareas con participantes: objetivo inicial de al menos 80 % de finalización sin ayuda directa, cero bloqueos críticos; registrar errores, ayuda y tiempos por tarea/rol. | Observaciones individuales y tamaño/composición real de la muestra. Es una meta, no resultado ni inferencia poblacional. |
| Q-08 | Operación | Instalación y migraciones reproducibles; recuperación de datos ficticios comprobada; purga activa en un máximo de 24 h desde el vencimiento de 30 días. | Registro de despliegue, respaldo/recuperación y eliminación. |
| Q-09 | Costos | Funcionamiento del escenario sin activar planes de pago y con consumo dentro de cuotas medidas. | Configuración de servicios y registro de consumo. |

Q-06 y Q-09 son metas simultáneas: no aprobar capacidad si para alcanzarla se exceden cuotas. Si no se cumplen, registrar limitación y cambio de diseño; no cambiar umbrales después de medir para declarar un éxito. La entrega 001 demuestra el recorrido, pero no cierra por sí sola la meta de concurrencia del producto completo.

Q-03 toma 44 × 44 píxeles CSS como objetivo de diseño para controles táctiles; verificar el criterio de tamaño/espaciado aplicable en cada caso. Documentar por separado defectos de contenido creado por el docente y los mecanismos del editor para prevenirlos, como texto alternativo e instrucciones.

## Tipos de prueba

| Tipo | Cobertura | Medio previsto |
|---|---|---|
| Reglas de negocio | Corrección, puntuación parcial, bonificaciones, redondeo, promedio, intentos y plazos. | Vitest, con casos de frontera y ejemplos de la especificación. |
| Integración | Relaciones, transacciones, versiones, idempotencia, migraciones y archivos. | Base/almacenamiento de prueba con datos ficticios. |
| Autorización | Docente propietario/ajeno; estudiante aprobado/pendiente/retirado/ajeno; visitante. | Operaciones directas y políticas reales del entorno aislado. |
| Recorridos | Acceso, aprobación, autoría, participación, corrección y publicación. | Playwright. |
| Accesibilidad | Errores detectables automáticamente, teclado, foco, lectura, zoom, táctil, tiempo y movimiento. | axe con Playwright y revisión manual. |
| Continuidad | Fallo antes/después de persistir, dos pestañas, vencimiento y desconexión docente/estudiante. | Fallos simulados y registros de servidor. |
| Carga | Cuatro actividades simultáneas y sus docentes; presión sobre operaciones relevantes. | Herramienta a seleccionar al definir el transporte. |
| Uso con personas | Comprender instrucciones, publicar, participar y consultar notas. | Observación de tareas sin encuesta obligatoria. Si no se realiza, queda pendiente explícitamente. |
| Liberación | Migraciones, pruebas breves tras despliegue y restauración. | Procedimientos reproducibles y datos ficticios. |

Vitest, axe, Playwright, PGlite y GitHub Actions están configurados. Sus versiones están fijadas en el repositorio; los resultados vigentes constan en [integración web](../verificacion/integracion-web.md), [SQL aislado](../verificacion/datos-aislados.md) y [Supabase real](../verificacion/datos-remotos.md). La existencia de herramientas no cierra los criterios Q ni autoriza porcentajes de cobertura sin medición.

## Escenario de carga

Datos: cuatro materias/actividades, 50 estudiantes de prueba en cada una y cuatro docentes. Preparar diez preguntas válidas por actividad. Calentar cinco minutos y medir durante quince minutos con las 204 sesiones activas; escalonar respuestas para representar el uso y ejecutar además una ráfaga donde los 200 estudiantes responden en dos segundos. Separar datos del calentamiento y medición. Si hacen falta rondas adicionales, configurar intentos de práctica para avance individual y crear nuevas actividades para sesiones guiadas; no reabrir intentos cerrados ni alterar sus reglas para prolongar la carga.

Medir por separado avance individual y guiado, confirmación persistente, apertura de pregunta, lectura de resultados y consumo por servicio. No incluir cargas de archivos en esos umbrales; medirlas por tamaño en un escenario adicional. Los datos inválidos rechazados intencionalmente no cuentan como fallo técnico de solicitudes válidas.

Documentar región de aplicación/base, capacidades del generador, latencia de red, caché, tamaños y configuración de sincronización. Los umbrales aplican a ese entorno; no prometer los mismos tiempos en cualquier conexión. Los reportes usan hora de servidor para consistencia. Un resultado local no se atribuye al alojamiento remoto.

## Compatibilidad

Matriz inicial: Chromium y Firefox en escritorio; WebKit para compatibilidad de motor; comprobación táctil en un teléfono Android con Chrome y, cuando esté disponible, Safari en iOS. Registrar versiones reales. Emulación de móvil no se describe como una prueba en dispositivo físico. Si falta un dispositivo, dejar esa verificación pendiente sin declarar soporte comprobado.

## Trazabilidad y evidencia

La [matriz](trazabilidad.md) vincula requisitos, reglas, tareas y casos. Conservar por ejecución: caso, commit, entorno, fecha real, datos ficticios, pasos, esperado, observado, resultado, defecto y evidencia. Valores de resultado: no ejecutado, aprobado, fallido o bloqueado. La condición de bloqueo incluye causa y dependencia.

Evidencias en el repositorio solo con datos ficticios, sin sesiones, claves, correos personales ni capturas de cuentas reales. Cada figura o exportación seleccionada necesita un propósito y una versión; una captura no prueba por sí sola autorización o persistencia. Conservar la fuente editable de diagramas junto con la exportación legible.

Jira puede organizar un único tablero propio de tareas y defectos. QMetry, si se adopta, gestiona casos y ciclos; los identificadores de este repositorio se mantienen para evitar divergencias. La ausencia de QMetry no impide ejecutar pruebas o registrar sus resultados. Herramientas de pago requieren una decisión independiente.

## Defectos y mejora

- Crítico: exposición de información, corrupción/pérdida confirmada, cálculo sistemáticamente incorrecto o imposibilidad de completar el recorrido central. Bloquea liberación.
- Alto: función principal o acceso por teclado/lector bloqueado sin alternativa razonable. Bloquea liberación del alcance afectado.
- Medio/bajo: incidencia con alternativa o defecto de presentación que no altera resultados; registrar prioridad y condición de aceptación antes de liberar.

Por defecto: descripción reproducible, requisito, severidad, causa cuando se conozca, corrección, commit y nueva ejecución. No cerrar por haber escrito código. Revisar si la causa exige otro caso o mejora del procedimiento. Los defectos de ejemplo se etiquetan como ejemplos y no se contabilizan como hallazgos reales.

Métricas: casos aprobados/fallidos/bloqueados/no ejecutados sobre el total de la versión, defectos abiertos por severidad, resultados de latencia y consumo, incidencias de accesibilidad y finalización de tareas de uso. No utilizar solo cobertura de código para declarar calidad.

## Integración y liberación

CI se configura con la aplicación: instalación reproducible, análisis estático, tipos, pruebas pertinentes, construcción y comprobaciones de datos/recorridos en entorno aislado. Los cambios solo documentales no disparan pruebas costosas de aplicación sin una razón concreta.

La entrega continua prepara y comprueba el despliegue en entorno de prueba. Producción se habilita al cerrar la versión: casos obligatorios aprobados, cero defectos críticos/altos abiertos en el alcance, permisos comprobados, evidencia de recuperación y limitaciones explícitas. La evaluación con personas pendiente impide afirmar usabilidad validada, aunque no impide una demostración técnica claramente identificada.

Verificar qué protecciones admite el plan de GitHub antes de afirmar bloqueos automáticos. No publicar producción por una integración de alojamiento que se adelante a las pruebas. Tras desplegar, comprobar acceso, recurso publicado, respuesta y consulta de nota con datos ficticios. Revertir aplicación y recuperar datos son procedimientos distintos.

## Fuentes

- [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [Playwright: accesibilidad](https://playwright.dev/docs/accessibility-testing).
- [Playwright: integración continua](https://playwright.dev/docs/ci-intro).
- [GitHub Actions: integración continua](https://docs.github.com/en/actions/get-started/continuous-integration).
