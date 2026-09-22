# Ruta de desarrollo de Aulify

Fecha de revisión: 22 de septiembre de 2026.

Estado: ruta propuesta con Supabase, Playwright y GitHub Actions seleccionados. Las demás tecnologías candidatas y los criterios numéricos pendientes requieren definición y comprobación. Esta ruta no acredita una implementación ni pruebas realizadas.

El primer resultado funcional será un recorrido completo: un docente crea una materia, aprueba a un estudiante, prepara y publica un recurso con explicaciones y preguntas, el estudiante participa y el docente revisa y publica el resultado. Las entregas posteriores amplían ese recorrido hasta cubrir el alcance de la [especificación](../specification.md).

## Punto de partida comprobado

El [plan](../plan.md) mantiene Next.js, React y TypeScript como propuesta para la aplicación. La selección vigente utiliza Supabase con PostgreSQL, Auth y Storage, además de Playwright y GitHub Actions para recorridos e integración continua. La [decisión de arquitectura](decisiones/0001-supabase.md) sustituye la combinación anterior de datos e identidad. Su selección no acredita una configuración implementada ni capacidad validada.

Los documentos existentes se conservan como punto de partida. El desarrollo puede empezar cuando estén resueltas las dependencias de una entrega; las funciones posteriores pueden mantener pendientes expresamente identificados.

## Entregas y condiciones de finalización

| Entrega | Trabajo y relación con las tareas | Evidencia necesaria para cerrarla |
|---|---|---|
| 0. Especificación inicial ejecutable | Precisar cuentas, permisos, estados, versiones, puntuación y publicación que afecten al primer recorrido. Desarrolla T-02 y prepara T-03. | Ejemplos con resultados esperados, decisiones registradas y ausencia de ambigüedades que bloqueen la primera entrega. |
| 1. Fundamentos de diseño y viabilidad técnica | Redefinir estilo manteniendo el logotipo. Comprobar Supabase y las alternativas de correo y sincronización con un experimento reducido. T-01, T-03 y T-04. | Prototipos de editor, participación y revisión en móvil y escritorio; modelo conceptual; resultados reales de permisos, datos, archivos, recuperación por correo y sincronización. |
| 2. Primer recorrido funcional | Inicializar aplicación, acceso, materia, aprobación, recurso con explicación y preguntas de selección, participación y revisión. Partes de T-05 a T-12 y T-14. | Recorrido reproducible entre dos cuentas; persistencia; acceso ajeno rechazado; versión publicada conservada; puntuación y publicación comprobadas; capturas de la versión ejecutada. |
| 3. Recursos y actividades completas | Completar biblioteca, copias, tipos de preguntas, corrección manual, modos de avance, disponibilidad, mezcla, tiempo y reconexión. Completar T-08 a T-12. | Casos representativos por tipo de pregunta y estado; reconexión sin duplicaciones; tiempo controlado por servidor; soluciones ocultas protegidas. |
| 4. Evaluación y seguimiento | Tareas con archivos, reentregas, actividades manuales, promedio, gráficos y filtros. T-13, T-14 y T-16. | Casos de cálculo con resultados esperados; separación entre notas corregidas y publicadas; archivos privados; tablas y gráficos con los mismos valores. |
| 5. Juego y ciclo de vida | Equipos, clasificación, rachas, sonidos y potenciadores; incidencias; archivo, restauración y eliminación. T-15, T-17 y T-18. | Reglas coherentes cuando se ocultan aciertos; consumo único de potenciadores; incidencias sin sanción automática; restauración y eliminación verificadas. |
| 6. Comprobación integral y operación | Completar T-19, T-20 y T-21. | Informe de pruebas funcionales, seguridad de acceso, accesibilidad, carga, consumo y recuperación; defectos corregidos y limitaciones explícitas; manuales y versión publicada. |

La segunda entrega es una porción comprobable del producto, no una reducción definitiva del alcance. Una tarea parcialmente cubierta seguirá pendiente hasta satisfacer todos sus criterios. La accesibilidad, las comprobaciones y la documentación se incorporan en cada entrega; la última reúne y completa la evidencia.

## Objetivos de ejecución y revisión

Las entregas se organizan por dependencias y resultados comprobables.

| Orden | Hito previsto | Condición para avanzar |
|---|---|---|
| 1 | Completar las decisiones de la primera entrega, comprobar los servicios seleccionados y acordar fundamentos visuales. | Criterios escritos, modelo conceptual y prueba técnica con resultados registrados; identificar cualquier incompatibilidad con cuotas gratuitas. |
| 2 | Construir el primer recorrido entre docente y estudiante. | Crear, publicar, participar y revisar con persistencia y permisos comprobados. |
| 3 | Completar recursos, modos de actividad, preguntas, corrección, tareas y publicación de notas. | Versiones coherentes, cálculo comprobado y reconexión sin pérdida o duplicación de respuestas. |
| 4 | Integrar equipos, potenciadores, gráficos, incidencias y conservación. | Compatibilidad de reglas y revisión de los recorridos completos en ambos roles. |
| 5 | Preparar la versión integrada. | Construcción reproducible, servicios configurados, comprobaciones pertinentes y lista explícita de limitaciones o defectos pendientes. |
| 6 | Estabilizar, completar evidencias y verificar la demostración. | Corregir fallos prioritarios; alinear diagramas, manuales, capturas y versión publicada; comprobar recuperación y datos de demostración. |

## Decisiones que deben cerrarse primero

1. **Cuentas y pertenencia:** verificación del correo, cambios de perfil, expiración y renovación de códigos, retiro de integrantes y tratamiento de sesiones activas.
2. **Estados del recurso y de la actividad:** borrador, publicación, apertura, cierre, corrección y publicación de notas; reglas al editar contenido que ya tiene respuestas.
3. **Resultados:** fórmulas de puntos y nota, precisión y redondeo, distribución por elementos, resultado sin actividades evaluadas y efecto de bonificaciones.
4. **Información visible:** combinación de ocultar aciertos con puntos, rachas, clasificación y explicaciones. No revelar indirectamente una solución que debe permanecer oculta.
5. **Persistencia y continuidad:** autoridad del reloj, reconexión, envío repetido y conflictos de guardado. Una respuesta duplicada no cambia la puntuación ni consume otra bonificación.
6. **Calidad medible:** tamaños y navegadores objetivo, límites de archivos, tareas de uso y procedimiento de evaluación, umbrales de latencia, errores y persistencia bajo carga.

Las decisiones de equipos o informes que no afecten al primer recorrido se cierran antes de sus respectivas entregas. Cada decisión debe indicar alternativas, motivo, consecuencias y estado: propuesta, aceptada o sustituida.

## Evaluación tecnológica

La arquitectura candidata es una aplicación modular con interfaz y operaciones de servidor dentro del mismo proyecto. Se separan responsabilidades de acceso, materias, recursos, actividades y evaluación. La separación de módulos no exige microservicios.

| Área | Selección o propuesta | Motivo y comprobación pendiente |
|---|---|---|
| Aplicación | Next.js, React y TypeScript | Mantener la propuesta inicial para compartir tipos y organizar interfaz y operaciones de servidor. Fijar versiones compatibles al inicializar; verificar despliegue y permisos. |
| Datos académicos | PostgreSQL mediante Supabase, seleccionado | Definir relaciones, restricciones, operaciones consistentes y consultas de calificaciones. Registrar modelo relacional, normalización, permisos, migraciones, copias y recuperación. |
| Identidad y archivos | Supabase Auth y Storage, seleccionados | Comprobar recuperación por SMTP, sesiones, políticas de acceso, cuotas y archivos privados. |
| Interfaz | React Aria Components y estilos propios | Evaluar controles con comportamiento accesible y libertad de diseño. Comprobar composición real, foco, teclado y uso táctil; la biblioteca no acredita por sí sola la accesibilidad de la aplicación. |
| Editor | BlockNote como primer candidato | Probar bloques educativos personalizados, serialización y versiones, autosave, móvil y reordenamiento mediante teclado. Revisar las licencias de los paquetes concretos y evitar asumir que toda extensión está incluida sin costo. |
| Pruebas | Playwright seleccionado; Vitest y axe propuestos | Verificar reglas de negocio, recorridos y barreras detectables automáticamente. Complementar con inspección manual y evidencia visual. |
| Integración continua | GitHub Actions, seleccionado | Ejecutar tipos, análisis estático, pruebas, construcción y recorridos de Playwright; conservar informes asociados a cada cambio dentro de cuotas. Implementación pendiente. |
| Despliegue | Vercel Hobby como candidato | Comprobar elegibilidad de uso personal no comercial y cuotas. El transporte de sesiones en vivo debe corresponder con las capacidades del proveedor elegido. |

La documentación oficial confirma que Supabase utiliza PostgreSQL. La selección se deriva de las relaciones de materias, integrantes, versiones, intentos, respuestas y calificaciones de Aulify. El diseño debe documentar normalización, claves y cardinalidades y conservar diagramas coherentes con las migraciones. Fuentes: [Next.js](https://nextjs.org/docs) y [PostgreSQL en Supabase](https://supabase.com/docs/guides/database/overview).

### Restricciones concretas de los servicios gratuitos

Supabase Free publica un máximo de 200 conexiones simultáneas de Realtime y 100 mensajes por segundo. La meta existente de cuatro actividades con 50 estudiantes suma 200 estudiantes; si cada uno y cada docente mantienen una conexión, 204 conexiones superarían el límite. Es un cálculo de planificación, no una prueba de rendimiento. La arquitectura debe resolver este punto antes de adoptar ese transporte; no se reduce la meta ni se activa un plan de pago de manera implícita. Fuente: [límites de Realtime](https://supabase.com/docs/guides/realtime/limits).

El correo predeterminado de Supabase está limitado a direcciones autorizadas del equipo y no sirve como solución de recuperación para todos los estudiantes. Evaluar y configurar un proveedor SMTP adecuado, sus cuotas y los requisitos del remitente antes de considerar terminada la autenticación. Fuente: [correo y SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

El plan gratuito de Supabase incluye 500 MB de base de datos, 1 GB de archivos y pausa tras una semana de inactividad; no incluye copias automáticas. Deben estimarse las operaciones del quiz, verificarse bajo carga y establecerse procedimientos de exportación y recuperación. Fuente: [planes de Supabase](https://supabase.com/pricing).

Vercel Hobby se limita a uso personal no comercial. La elegibilidad y las condiciones de despliegue deben verificarse frente al uso previsto. Fuente: [Vercel Hobby](https://vercel.com/docs/plans/hobby).

Los precios y condiciones se consultaron el 22 de septiembre de 2026. Volver a comprobarlos cuando se adopte la selección definitiva y sincronizar el [registro de costos](costos-servicios.md).

### Experimento de viabilidad

Construir una prueba pequeña con datos ficticios: dos roles, una materia, una solicitud pendiente y otra aprobada, una publicación versionada, una respuesta persistida, un archivo privado y recuperación por correo. Probar también lectura no autorizada, reintento de envío y reconexión. El experimento debe registrar configuración, versiones, resultados y consumo.

Evaluar por separado el editor: crear una explicación y una pregunta, guardar, recuperar, copiar, publicar y reordenar con teclado y con pantalla táctil. Verificar que una edición posterior no altera la versión ya respondida y que el estudiante no descarga soluciones ocultas.

Con estos resultados, registrar la configuración comprobada y las decisiones restantes de correo y sincronización; actualizar plan, tareas y costos de forma consistente. Una biblioteca disponible o un servicio gratuito no sustituye estas comprobaciones.

## Diseño de Aulify

Conservar el logotipo como activo de identidad y definir nuevamente el sistema visual: tipografía, jerarquías, paleta con roles semánticos, espacios, radios, iconografía, ilustraciones y movimiento. Registrar licencias y procedencia de los materiales.

Comparar dos direcciones visuales usando las mismas tres pantallas: editor del docente, participación del estudiante y revisión de resultados. Cada dirección debe incluir móvil y escritorio, suficiente texto real en español y estados de carga, vacío, error, espera y desconexión. Elegir por claridad y continuidad de las tareas, además de preferencia estética.

En Figma, organizar fundamentos, componentes, pantallas docentes, pantallas estudiantiles y prototipos. El logo, los iconos y las ilustraciones pueden conservarse como SVG. Las pantallas necesitan texto, componentes, variantes y disposición adaptativa editables. Enlazar cada pantalla con su requisito y la versión correspondiente del código.

Los valores reutilizables de color, tipografía y espaciado deben tener nombres compartidos entre diseño y aplicación. Los componentes deben incluir foco, error, deshabilitado y carga. La interfaz principal mostrará acciones comprensibles y la configuración avanzada será progresiva.

React Aria permite aplicar estilos propios; BlockNote permite crear bloques y personalizar su interfaz. Son capacidades a evaluar frente al diseño de Aulify. Fuentes: [React Aria](https://react-aria.adobe.com/), [BlockNote](https://www.blocknotejs.org/docs) y [licencias de sus paquetes](https://github.com/TypeCellOS/BlockNote#license-).

## Documentación que acompaña al desarrollo

| Producto documental | Momento y contenido mínimo |
|---|---|
| Requisitos y criterios de aceptación | Antes de implementar cada entrega. Identificador, actor, comportamiento, excepciones y ejemplos con resultado esperado. |
| Decisiones de arquitectura | Al escoger o cambiar una tecnología. Alternativas, restricciones, evidencia y consecuencias. |
| Modelo de datos | Antes de construir la persistencia. Entidades, relaciones, cardinalidades, campos, restricciones, índices y permisos; después, mantenerlo alineado con la implementación. |
| Diagramas de arquitectura y despliegue | Mostrar módulos, servicios externos, comunicación y responsabilidades reales. Conservar fuente editable y exportación. |
| Diagramas de estados y secuencia | Recurso, actividad, intento y calificación; publicación, respuesta, reconexión y revisión. Deben coincidir con las reglas y operaciones implementadas. |
| Diseño y decisiones de interacción | Flujos, pantallas, estados, componentes y motivos de cambios, con referencias a la versión de Figma. |
| Gestión del trabajo | Tareas con requisito, dependencia, responsable, estado, cambio de código y evidencia de cierre. |
| Plan e informe de pruebas | Caso, requisito, datos de prueba, entorno, versión, resultado esperado, resultado observado, incidencia y evidencia. Mantener visibles los fallos y las correcciones. |
| Manuales | Uso docente y estudiantil; instalación, configuración, despliegue, respaldo, recuperación y mantenimiento. |
| Registro de versiones | Funciones entregadas, requisitos cubiertos, cambios conocidos y limitaciones pendientes. |

Usar GitHub Projects con Issues como candidato para el tablero, por su conexión con cambios de código y revisiones. Elegir una sola herramienta de seguimiento; otra herramienta puede sustituirla si existe una necesidad concreta. Fuente: [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects).

La trazabilidad relaciona requisito, decisión, diseño, tarea, implementación, prueba y evidencia. Ejemplo: RF-03 → criterio de recuperar un borrador → diseño del estado de guardado → T-08 → cambio de código → prueba de reabrir el editor → captura y resultado asociados a la misma versión.

Las capturas son evidencia de una ejecución identificada, no sustituyen una prueba de permisos, cálculo o persistencia. Usar datos ficticios y registrar fecha, versión, entorno y procedimiento para reproducir cada comprobación.

## Comprobación de usabilidad y accesibilidad

Definir antes de evaluar las tareas, los criterios y la forma de registrar resultados. Los recorridos centrales son crear y publicar un recurso, incorporarse a una materia, participar, entregar y revisar resultados. Medir finalización, errores, necesidad de ayuda y tiempos en condiciones identificadas.

Los recorridos técnicos y la inspección de accesibilidad son evidencia del comportamiento del sistema. Para afirmar que docentes y estudiantes lo encuentran fácil de usar se necesita una evaluación con participantes reales y un procedimiento adecuado. Si esa evaluación no se realiza, documentar el alcance técnico de los resultados y la validación con usuarios pendiente.

Comprobar teclado, foco, etiquetas, lectura, contraste, adaptación de pantalla, alternativas a arrastrar, tiempo y reducción de movimiento. Probar los estados de error y desconexión, además de las pantallas iniciales. Las herramientas automáticas detectan parte de las barreras y deben complementarse con evaluación manual. Fuentes: [W3C WAI](https://www.w3.org/WAI/test-evaluate/) y [Playwright con axe](https://playwright.dev/docs/accessibility-testing).

## Organización incremental de los documentos

Mantener docs/producto.md como entrada breve; docs/principios.md como principios; specification.md como alcance general y reglas transversales; plan.md como arquitectura vigente; tasks.md como mapa de dependencias.

Al preparar cada entrega, crear una carpeta de especificación solo si su detalle lo requiere, con spec.md, plan.md y tasks.md. Enlazar las reglas generales y no mantener copias divergentes. Agregar modelo de datos, contratos de operaciones, decisiones y pruebas cuando exista contenido concreto. El nombre del archivo no garantiza la calidad de una especificación.

## Condición de entrega

Una función está lista cuando cumple sus criterios, se integra con los permisos y datos reales de prueba, conserva la coherencia de resultados y versiones, funciona en los dispositivos previstos y tiene evidencia de las comprobaciones pertinentes. El diseño, los diagramas y los manuales se actualizan para describir esa misma versión. Los resultados todavía no comprobados permanecen explícitamente pendientes.
