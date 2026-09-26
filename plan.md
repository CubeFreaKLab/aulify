# Plan técnico de Aulify

**Estado: Supabase, Playwright y GitHub Actions seleccionados; implementación y comprobación técnica pendientes.**

Este documento desarrolla cómo abordar los requisitos de [specification.md](specification.md). No describe una aplicación ya implementada. Las reglas funcionales se mantienen en la especificación y los costos en [docs/costos-servicios.md](docs/costos-servicios.md).

El [plan de la entrega 001](specs/001-recurso-interactivo/plan.md) concreta las entidades, operaciones y comprobaciones del primer recorrido. Sus decisiones operativas están definidas en el [spec de 001](specs/001-recurso-interactivo/spec.md), versión 1.0.

## 1. Arquitectura propuesta

Una aplicación web modular con interfaz y operaciones de servidor dentro del mismo proyecto. Los módulos separan responsabilidades, pero el inicio no requiere despliegues independientes ni microservicios.

| Componente | Selección o propuesta | Responsabilidad |
|---|---|---|
| Interfaz y aplicación web | Next.js, React y TypeScript | Pantallas, editor, participación, tareas y resultados. |
| Operaciones de servidor | Entorno Node.js de la aplicación | Validación de permisos, reglas académicas, publicación de notas y operaciones sensibles. |
| Identidad | Supabase Auth, Free | Acceso con correo y contraseña; configurar y comprobar un proveedor SMTP para recuperación por correo. |
| Datos | PostgreSQL de Supabase, Free | Modelo relacional de materias, integrantes, recursos versionados, actividades, intentos, respuestas y calificaciones. |
| Sincronización | Transporte por comprobar | Evaluar Realtime y alternativas compatibles con las cuotas y con la carga objetivo; la elección de base de datos no determina por sí sola este transporte. |
| Archivos privados | Supabase Storage, Free | Imágenes y entregas con políticas de acceso vinculadas a la pertenencia y los permisos. |
| Despliegue | Vercel Hobby si el uso es elegible | Aplicación publicada por HTTPS. Render se evalúa como alternativa, considerando sus límites. |
| Versionado e integración continua | GitHub Free y GitHub Actions | Ejecutar comprobaciones y conservar informes vinculados a cada cambio, dentro de las cuotas. |
| Pruebas de recorridos | Playwright | Comprobar los flujos entre roles en navegador y su presentación en distintos tamaños de pantalla. |

La [decisión de Supabase](docs/decisiones/0001-supabase.md) sustituye la combinación anterior de proveedores. Las versiones de dependencias se fijarán al inicializar la aplicación y quedarán registradas en el archivo de bloqueo. No se seleccionará una biblioteca de editor o gráficos solo por su apariencia: primero se comprobarán licencia, accesibilidad, soporte móvil y encaje con los requisitos.

## 2. Prueba técnica previa al desarrollo de funciones

Comprobar con datos ficticios el recorrido mínimo: iniciar sesión, recuperar el acceso por correo, crear una materia, aprobar una solicitud, guardar y leer datos con permisos y subir un archivo privado. Esto permite verificar Supabase y sus servicios auxiliares antes de construir el editor completo.

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

La capa de interfaz no decide permisos ni resultados académicos. El servidor valida las operaciones sensibles y las reglas de acceso restringen las lecturas y escrituras directas.

## 4. Modelo de información propuesto

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

Elaborar el modelo conceptual, el modelo relacional y el esquema físico de PostgreSQL. Documentar entidades, cardinalidades, claves primarias y foráneas, dependencias funcionales, normalización hasta tercera forma normal cuando corresponda, restricciones, índices y políticas de acceso. Justificar las excepciones y evitar duplicaciones que puedan producir notas o pertenencias inconsistentes.

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

La interfaz mantendrá la transición continua del quiz y presentará errores cuando impidan avanzar. El guardado persistente es una necesidad técnica; no obliga a mostrar una pantalla de confirmación entre preguntas.

## 6. Comunicación y costo de las sesiones

Propuesta: escuchar únicamente el estado de sesión necesario, las respuestas propias del estudiante y los datos autorizados para el docente. Evitar que cada estudiante descargue todas las respuestas del grupo.

Supabase Free admite 200 conexiones simultáneas de Realtime. Si cada uno de los 200 estudiantes y cuatro docentes mantiene una conexión, se requieren 204, por encima de esa cuota. Antes de adoptar Realtime para todos los participantes, evaluar un transporte compatible con el inicio gratuito, incluyendo consultas periódicas o una combinación de mecanismos, y medir su latencia y consumo. Esta evaluación no reduce la carga objetivo ni acredita su cumplimiento. [Límites de Realtime](https://supabase.com/docs/guides/realtime/limits).

El objetivo es probar cuatro actividades simultáneas con 50 estudiantes cada una, además de sus docentes. Medir consumo, respuestas persistidas, errores y tiempos bajo esa carga. Los umbrales están definidos en el [plan de calidad](docs/calidad/plan-de-calidad.md); el objetivo no implica una capacidad ya demostrada.

Los mecanismos de clasificación y progreso deben respetar la configuración que oculta aciertos. Las reglas JU-01 a JU-08 de la especificación determinan esa combinación y deben comprobarse antes de publicar señales de puntuación o rachas.

## 7. Experiencia y accesibilidad

Diseñar y comprobar en celular y computadora los recorridos de ambos roles: crear, publicar, participar, entregar y revisar. Mantener una configuración principal breve y opciones avanzadas desplegables.

Las pruebas incluirán teclado, foco visible, nombres de controles, contraste, alternativas a arrastrar, instrucciones, recuperación ante errores, tiempo ajustable y tablas equivalentes a los gráficos. Se registrarán los criterios aplicables de [WCAG 2.2](https://www.w3.org/TR/WCAG22/) comprobados y los pendientes; no se declarará conformidad a partir de una revisión parcial.

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

Cada registro de prueba incluirá versión, entorno, datos ficticios utilizados, procedimiento, resultado y limitaciones. Una comprobación técnica no equivale a una evaluación con usuarios reales.

## 10. Decisiones antes de implementar

La especificación 1.0 define puntuación, redondeo, publicación, mezcla, desempates, reentregas, visibilidad y ayuda. Queda concretar la implementación: SMTP, transporte guiado, modelo relacional/RLS, contratos, despliegue, versiones, respaldo y eliminación periódica. Las decisiones funcionales nuevas se versionan antes de implementarse. Los [criterios de calidad](docs/calidad/plan-de-calidad.md) y la [trazabilidad](docs/calidad/trazabilidad.md) orientan las comprobaciones.

El orden de ejecución y la evidencia de finalización se mantienen en [tasks.md](tasks.md).

## 11. Integración continua con GitHub Actions

GitHub Actions ejecutará las comprobaciones al proponer cambios mediante pull requests y al integrar cambios en la rama principal. La configuración se añadirá al inicializar la aplicación y usar comandos reales del proyecto; por ahora no existe un flujo ejecutado.

El flujo previsto comprende instalación reproducible de dependencias, análisis estático, comprobación de tipos, pruebas de reglas de negocio, construcción de la aplicación, pruebas de migraciones y permisos en un entorno aislado y recorridos de Playwright. Vitest y axe se mantienen como herramientas propuestas para cálculos y comprobaciones automáticas de accesibilidad. La evaluación manual de accesibilidad sigue siendo necesaria.

Las pruebas de base de datos usarán datos ficticios y una instancia de prueba aislada, preferentemente Supabase local en el ejecutor si el experimento confirma su viabilidad. Comprobar restricciones, consultas y RLS con usuarios y permisos reales de prueba. No ejecutar restablecimientos ni migraciones de prueba contra la base de datos de uso.

Los informes identificarán el cambio de código, entorno y resultado. Conservar reportes de Playwright y capturas o trazas de fallos con retención acotada; las evidencias seleccionadas para una entrega se preservarán por separado con su versión. Cancelar ejecuciones obsoletas de una misma rama para limitar consumo y evitar disparar pruebas costosas por cambios que no las afectan. Configurar tiempos máximos y permisos mínimos para los flujos.

La aprobación de comprobaciones obligatorias se configurará como condición de integración si el plan y la visibilidad del repositorio lo permiten; verificarlo antes de declarar una protección automática. El despliegue automático y la creación de recursos externos requieren una configuración independiente y todavía no están implementados. Fuentes: [integración continua](https://docs.github.com/en/actions/get-started/continuous-integration) y [cuotas de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
