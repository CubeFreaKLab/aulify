# Plan técnico de Aulify

**Estado: prototipo web implementado con datos ficticios, pruebas locales registradas y GitHub Actions configurado. Supabase y la prueba técnica T-01 siguen pendientes.** La comprobación local final está en curso y el resultado remoto de Actions debe verificarse después del push.

Este documento desarrolla cómo abordar los requisitos de [specification.md](specification.md) y distingue la implementación del prototipo de los servicios que necesita el producto. El adaptador local permite explorar los recorridos; no acredita autenticación, permisos de servidor ni producción. Las reglas funcionales se mantienen en la especificación, los costos en [docs/costos-servicios.md](docs/costos-servicios.md) y los resultados observados en [pruebas del prototipo](docs/verificacion/pruebas-prototipo.md).

El [plan de la entrega 001](specs/001-recurso-interactivo/plan.md) concreta las entidades, operaciones y comprobaciones del primer recorrido. Sus decisiones operativas están definidas en el [spec de 001](specs/001-recurso-interactivo/spec.md), versión 1.0.

## 1. Arquitectura y base implementada

El prototipo utiliza una aplicación Next.js modular, con componentes de interfaz, contratos de dominio, reglas y un adaptador de demostración persistente en el navegador. La arquitectura prevista mantiene interfaz y operaciones de servidor dentro del mismo proyecto; estas últimas y Supabase todavía requieren integración. Los módulos separan responsabilidades sin despliegues independientes ni microservicios.

| Componente | Implementación o selección | Responsabilidad |
|---|---|---|
| Interfaz y aplicación web | Next.js 16.3.6, React 19.3.0 y TypeScript 6.0.3 instalados | Pantallas y recorridos del prototipo; contratos reutilizables para la integración. |
| Componentes y editor | React Aria Components 1.21.1; BlockNote Core/React/Ariakit 0.55.0 integrados | Controles y diálogos compartidos con estilos propios; editor por bloques con esquema personalizado. |
| Persistencia de demostración | Adaptador local implementado | Conservar y reiniciar datos ficticios; no representa una frontera de seguridad. |
| Operaciones de servidor | Entorno Node.js de la aplicación, integración pendiente | Validación confiable de permisos, reglas académicas, publicación de notas y operaciones sensibles. |
| Identidad | Supabase Auth, Free | Acceso con correo y contraseña; configurar y comprobar un proveedor SMTP para recuperación por correo. |
| Datos | PostgreSQL de Supabase, Free | Modelo relacional de materias, integrantes, recursos versionados, actividades, intentos, respuestas y calificaciones. |
| Sincronización | Transporte por comprobar | Evaluar Realtime y alternativas compatibles con las cuotas y con la carga objetivo; la elección de base de datos no determina por sí sola este transporte. |
| Archivos privados | Supabase Storage, Free | Imágenes y entregas con políticas de acceso vinculadas a la pertenencia y los permisos. |
| Despliegue | Vercel Hobby si el uso es elegible | Aplicación publicada por HTTPS. Render se evalúa como alternativa, considerando sus límites. |
| Versionado e integración continua | GitHub Actions configurado; resultado remoto pendiente | Ejecutar las comprobaciones existentes y conservar informes vinculados a cada cambio. |
| Pruebas de recorridos | Playwright 1.63.0 y axe 4.13.0 integrados | Recorridos locales entre perfiles ficticios, escritorio, móvil emulado y revisión automática de accesibilidad en vistas concretas. |
| Pruebas de reglas | Vitest 5.0.2 integrado | Puntuación, versiones, intentos y persistencia del adaptador local. |

La [decisión de Supabase](docs/decisiones/0001-supabase.md) sustituye la combinación anterior de proveedores. Las versiones de la base web están fijadas en `package.json` y `package-lock.json`; sus decisiones y límites constan en el [ADR 0004](docs/decisiones/0004-base-web.md). La elección de una biblioteca no acredita accesibilidad: las comprobaciones deben cubrir su composición real, los estados de uso y los dispositivos requeridos.

## 2. Prueba técnica previa al desarrollo de funciones

T-01 permanece pendiente según la [inspección de viabilidad](docs/verificacion/viabilidad-servicios.md): el motor Docker no estaba accesible y no se encontró configuración local de Supabase ni conexión de pruebas identificada. El prototipo avanza con sus contratos y datos ficticios; no sustituye esta prueba.

Cuando exista un entorno aislado, comprobar el recorrido mínimo: iniciar sesión, recuperar el acceso, crear una materia, aprobar una solicitud, guardar y leer datos con permisos y subir un archivo privado. Esta comprobación debe preceder a considerar integrada la persistencia real del editor y los resultados. Un buzón local solo verifica el flujo de correo local; la entrega por SMTP externo necesita evidencia aparte.

Supabase Auth identificará al usuario y PostgreSQL conservará los perfiles y relaciones del producto. Definir políticas de seguridad por fila (RLS) para las tablas expuestas y políticas de acceso para Storage. Los permisos deben impedir que cambiar una dirección o identificador permita consultar notas o entregas ajenas. Las credenciales administrativas permanecen en el servidor; una operación privilegiada debe verificar explícitamente los permisos del solicitante. Fuentes: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [tablas y relaciones](https://supabase.com/docs/guides/database/tables).

El correo predeterminado de Supabase se limita a destinatarios autorizados del equipo y no cubre el registro o la recuperación para todos los usuarios. Seleccionar un servicio SMTP compatible, verificar su remitente, cuotas y costo, y ejecutar una recuperación real con una cuenta de prueba antes de considerar completa la autenticación. [Documentación de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Las cargas de archivos deben evitar trasladar todo su contenido a través de operaciones de servidor con límites menores. Se comprobará una carga autorizada directa al almacenamiento, además de la validación de tipo, tamaño y pertenencia a la materia. El máximo admitido por un proveedor no define automáticamente el máximo del producto.

Si la combinación gratuita no satisface permisos, cuotas o continuidad, documentar la limitación y revisar la selección antes de implementar sus dependencias. No activar facturación para resolverla silenciosamente.

## 3. Organización de responsabilidades

| Área | Responsabilidades |
|---|---|
| Identidad y materias | Sesiones, perfiles, invitaciones, solicitudes, aprobación y pertenencia. |
| Recursos | Biblioteca, bloques, borradores, publicación, copias y versiones. |
| Actividades | Preguntas, configuración, apertura, cierre y modos de avance. |
| Participación | Intentos, respuestas, reconexión, tiempo y uso de potenciadores. |
| Evaluación | Corrección automática, revisión manual, publicación y promedios. |
| Tareas | Archivos, plazos, reemplazos y reentregas. |
| Seguimiento | Tablas, gráficos, filtros, clasificación e incidencias. |
| Conservación | Archivo de materias, restauración y eliminación de datos asociados. |

En el producto integrado, el servidor debe validar operaciones sensibles y las reglas de acceso restringir lecturas y escrituras directas. El prototipo ejecuta reglas sobre datos ficticios del navegador: permite verificar comportamiento, pero sus perfiles y filtros no acreditan permisos seguros ni calificaciones de uso real.

## 4. Modelo de información propuesto

El [modelo conceptual y relacional 1.0](docs/modelado/README.md) desarrolla las entidades resumidas aquí. Incluye fuente JSON, DBML, diccionario, cardinalidades, normalización, permisos e invariantes. El [ADR 0003](docs/decisiones/0003-modelo-relacional.md) explica las decisiones. Esquema físico y comprobación contra PostgreSQL pendientes.

| Entidad | Información o relación principal |
|---|---|
| Usuario | Identidad y perfil; los permisos se comprueban por operación. |
| Materia | Docente propietario, nombre, curso, año y estado de archivo. |
| Membresía | Materia, estudiante y estado de solicitud o aprobación. |
| Recurso y versión | Propietario, bloques, borrador mutable y versiones publicadas inmutables. |
| Actividad y sesión | Materia, versión utilizada, reglas configuradas, disponibilidad y estado de avance. |
| Intento y respuesta | Estudiante, actividad, tiempos, orden asignado, respuestas y estado de corrección. |
| Uso de potenciador | Actividad, estudiante, tipo y consumo; independiente de los intentos. |
| Entrega y versión | Actividad, estudiante, archivos y evaluación asociada a cada entrega. |
| Calificación | Resultado calculado o manual, máximo, peso y estado de publicación. |
| Incidencia | Señal registrada, contexto mínimo y revisión del docente. |
| Preferencia de ayuda | Cuenta, rol, versión de guía y estado ofrecido, omitido o completado. |

El modelo conceptual y relacional ya documenta entidades, cardinalidades, claves, dependencias, normalización y excepciones. Derivar de él el esquema físico de PostgreSQL, las restricciones e índices ejecutables y las políticas de acceso. Comprobar las invariantes entre relaciones; una FK válida no demuestra por sí sola pertenencia a la misma materia o coherencia de una publicación.

Conservar las migraciones SQL versionadas para reproducir el esquema. La estructura de los bloques del editor puede evaluarse como contenido JSONB versionado, con validación explícita; esta posibilidad no reemplaza las relaciones académicas ni autoriza guardar soluciones ocultas junto con datos que el estudiante puede consultar. El diagrama y el diccionario de datos deben corresponder con las migraciones vigentes.

Separar las consignas visibles de las soluciones y criterios que deben permanecer reservados. No enviar respuestas correctas ocultas dentro de los datos descargados por el estudiante.

## 5. Consistencia del quiz y las notas

- Usar hora de servidor para plazos y estados de cierre. Un reloj local modificado no debe extender el intento.
- Hacer idempotente el registro de respuestas: repetir una solicitud por desconexión no crea una respuesta duplicada ni consume dos veces una bonificación.
- Conservar el orden de preguntas asignado al intento al reconectar.
- Validar que la pregunta está disponible para el estudiante y el modo de avance antes de aceptar una respuesta.
- Calcular puntos en una operación confiable y dejar las respuestas escritas pendientes de corrección manual.
- Distinguir resultados guardados, corregidos y publicados. Recalcular el promedio con las reglas definidas y evitar revelar notas sin publicar.
- Preservar la versión utilizada al responder, así como las versiones de entregas y evaluaciones que deben conservarse.

El prototipo mantiene la transición continua del quiz y presenta errores cuando impiden avanzar. Los recorridos comprobaron avance sin corrección intermedia cuando se oculta el resultado y conservación de la versión respondida. Las garantías de tiempo de servidor, concurrencia y autorización siguen pendientes de la integración. El guardado persistente no obliga a mostrar una pantalla de confirmación entre preguntas.

## 6. Comunicación y costo de las sesiones

Propuesta: escuchar únicamente el estado de sesión necesario, las respuestas propias del estudiante y los datos autorizados para el docente. Evitar que cada estudiante descargue todas las respuestas del grupo.

Supabase Free admite 200 conexiones simultáneas de Realtime. Si cada uno de los 200 estudiantes y cuatro docentes mantiene una conexión, se requieren 204, por encima de esa cuota. Antes de adoptar Realtime para todos los participantes, evaluar un transporte compatible con el inicio gratuito, incluyendo consultas periódicas o una combinación de mecanismos, y medir su latencia y consumo. Esta evaluación no reduce la carga objetivo ni acredita su cumplimiento. [Límites de Realtime](https://supabase.com/docs/guides/realtime/limits).

El objetivo es probar cuatro actividades simultáneas con 50 estudiantes cada una, además de sus docentes. Medir consumo, respuestas persistidas, errores y tiempos bajo esa carga. Los umbrales están definidos en el [plan de calidad](docs/calidad/plan-de-calidad.md); el objetivo no implica una capacidad ya demostrada.

Los mecanismos de clasificación y progreso deben respetar la configuración que oculta aciertos. Las reglas JU-01 a JU-08 de la especificación determinan esa combinación y deben comprobarse antes de publicar señales de puntuación o rachas.

## 7. Experiencia y accesibilidad

El prototipo ofrece composiciones de escritorio y móvil, configuración principal y opciones avanzadas desplegables. Los recorridos se comprobaron en Chromium de escritorio y móvil emulado; todavía no acreditan comportamiento en teléfonos físicos ni con sus teclados virtuales. La dirección de marca y movimiento está en [diseño](docs/diseno/direccion-visual.md).

Las comprobaciones registradas incluyen estados concretos de teclado, foco, formularios, movimiento reducido, reflujo y análisis axe de seis vistas en dos tamaños. El editor incorpora botones para reordenar bloques y las preguntas disponen de alternativas al arrastre. La revisión manual con lector de pantalla, contraste en todos los estados y dispositivos físicos sigue pendiente. Registrar los criterios aplicables de [WCAG 2.2](https://www.w3.org/TR/WCAG22/) comprobados y los pendientes; no declarar conformidad a partir de esta revisión parcial.

Los controles contra trampas se limitarán a mecanismos descritos en la especificación y señales interpretables. No prometer detección de otro dispositivo ni bloquear el equipo. Toda incidencia queda a criterio de revisión del docente.

## 8. Conservación de materias y archivos

La materia archivada se puede restaurar durante 30 días. Tras el plazo, eliminar sus registros y archivos asociados sin afectar las cuentas, otras materias ni recursos independientes de la biblioteca.

Antes de implementar, definir un procedimiento periódico, verificable y compatible con las cuotas gratuitas. Documentar reintentos, fallos parciales, referencias compartidas y conservación temporal en copias de respaldo. No presentar la eliminación de datos activos como eliminación instantánea de todas las copias del proveedor.

## 9. Verificación y evidencia

| Riesgo | Comprobación prevista |
|---|---|
| Acceso a datos ajenos | Intentos de lectura, descarga, cambio de materia y modificación desde cuentas de ambos roles. |
| Errores de calificación | Casos representativos por tipo de pregunta, bonificaciones, corrección pendiente y promedio ponderado. |
| Pérdida o duplicación de respuestas | Reconexión, reintento de solicitud, vencimiento y cierre guiado. |
| Cambio de una actividad respondida | Publicar una edición y comprobar que la evaluación anterior conserva su versión. |
| Barreras de uso | Recorridos completos en móvil y computadora, con teclado y revisión de accesibilidad. |
| Cuotas insuficientes | Prueba de carga con registro del consumo por operación y proveedor. |
| Borrado incompleto | Archivar, restaurar y simular vencimiento; verificar registros y archivos de prueba. |

El [informe del prototipo](docs/verificacion/pruebas-prototipo.md) registra 24 pruebas unitarias y una batería local de 38 ejecuciones E2E aprobadas. Los lotes iniciales, las regresiones corregidas y las revisiones de código están identificados en ese informe. La ejecución remota posterior comprueba la revisión publicada con los ajustes finales de interfaz.

Cada registro incluye o debe completar versión, entorno, datos ficticios, procedimiento, resultado y limitaciones. Estos resultados sobre el adaptador local no aprueban los casos integrados de Supabase ni equivalen a una evaluación con usuarios reales.

## 10. Decisiones antes de implementar

La especificación 1.0 define puntuación, redondeo, publicación, mezcla, desempates, reentregas, visibilidad y ayuda. Queda concretar la implementación: SMTP, transporte guiado, modelo relacional/RLS, contratos, despliegue, versiones, respaldo y eliminación periódica. Las decisiones funcionales nuevas se versionan antes de implementarse. Los [criterios de calidad](docs/calidad/plan-de-calidad.md) y la [trazabilidad](docs/calidad/trazabilidad.md) orientan las comprobaciones.

El orden de ejecución y la evidencia de finalización se mantienen en [tasks.md](tasks.md).

## 11. Integración continua con GitHub Actions

El flujo [.github/workflows/web.yml](.github/workflows/web.yml) configura las comprobaciones para cambios de código y configuración en solicitudes de integración y en `main`, además de ejecución manual. La [ejecución 36343447881](https://github.com/CubeFreaKLab/aulify/actions/runs/36343447881) terminó correctamente sobre `56486c8`; su registro está en el informe del prototipo. Cada revisión posterior necesita su resultado correspondiente cuando afecta a código o configuración.

El flujo configurado usa Node.js 24 en Ubuntu, `npm ci`, ESLint, generación y comprobación de tipos de Next/TypeScript, Vitest, construcción y Playwright en Chromium. Incluye los análisis axe incorporados en los recorridos. Las acciones están fijadas por commit, usan permisos de lectura y conservan informes durante 14 días. No ejecuta migraciones ni RLS: esas comprobaciones todavía no están implementadas. La evaluación manual de accesibilidad sigue siendo necesaria.

En una integración posterior, las pruebas de base de datos usarán datos ficticios y una instancia aislada, preferentemente Supabase local en el ejecutor si el experimento confirma su viabilidad. Comprobar restricciones, consultas y RLS con usuarios y permisos reales de prueba. No ejecutar restablecimientos ni migraciones de prueba contra la base de datos de uso.

Los informes deben identificar cambio de código, entorno y resultado. El flujo conserva reportes de Playwright y resultados, cancela ejecuciones obsoletas de la misma rama y limita cada trabajo a 20 minutos. Las evidencias seleccionadas para una entrega se preservan por separado con su versión; los informes generados no se incorporan al código fuente.

La aprobación de comprobaciones obligatorias se configurará como condición de integración si el plan y la visibilidad del repositorio lo permiten; verificarlo antes de declarar una protección automática. El despliegue automático y la creación de recursos externos requieren una configuración independiente y todavía no están implementados. Fuentes: [integración continua](https://docs.github.com/en/actions/get-started/continuous-integration) y [cuotas de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
