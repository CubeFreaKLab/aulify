# Plan técnico de Aulify

**Estado: propuesta inicial, pendiente de comprobación técnica.**

Este documento desarrolla cómo abordar los requisitos de [specification.md](specification.md). No describe una aplicación ya implementada. Las reglas funcionales se mantienen en la especificación y los costos en [docs/costos-servicios.md](docs/costos-servicios.md).

## 1. Arquitectura propuesta

Una aplicación web modular con interfaz y operaciones de servidor dentro del mismo proyecto. Los módulos separan responsabilidades, pero el inicio no requiere despliegues independientes ni microservicios.

| Componente | Opción por evaluar | Responsabilidad |
|---|---|---|
| Interfaz y aplicación web | Next.js, React y TypeScript | Pantallas, editor, participación, tareas y resultados. |
| Operaciones de servidor | Entorno Node.js de la aplicación | Validación de permisos, reglas académicas, publicación de notas y operaciones sensibles. |
| Identidad | Firebase Authentication, Spark | Acceso con correo y contraseña y recuperación por correo. |
| Datos y cambios de sesión | Cloud Firestore, Spark | Materias, recursos versionados, actividades, intentos, respuestas y estados. |
| Archivos privados | Supabase Storage Free, candidato | Imágenes y entregas, con acceso ligado a la autorización en Aulify. |
| Despliegue | Vercel Hobby si el uso es elegible | Aplicación publicada por HTTPS. Render se evalúa como alternativa, considerando sus límites. |
| Versionado y verificaciones | GitHub Free y Actions | Cambios revisables y comprobaciones del proyecto dentro de cuotas. |

Las versiones de dependencias se fijarán al inicializar la aplicación y quedarán registradas en el archivo de bloqueo. No se seleccionará una biblioteca de editor o gráficos solo por su apariencia: primero se comprobarán licencia, accesibilidad, soporte móvil y encaje con los requisitos.

## 2. Prueba técnica previa al desarrollo de funciones

Comprobar con datos ficticios el recorrido mínimo: iniciar sesión, crear una materia, aprobar una solicitud, guardar y leer datos con permisos y subir un archivo privado. Esto permite verificar la combinación de proveedores antes de construir el editor completo.

La integración de Firebase Authentication con Supabase se apoyará en su [documentación oficial](https://supabase.com/docs/guides/auth/third-party/firebase-auth). Los permisos de archivos deben impedir que cambiar una dirección o identificador permita consultar entregas ajenas. Las credenciales administrativas permanecen en el servidor. No se presupone el uso de Cloud Functions ni la activación de Blaze.

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
| Recurso y versión | Propietario, bloques, borrador y versión publicada inmutable cuando está asociada a respuestas. |
| Actividad y sesión | Materia, versión utilizada, reglas configuradas, disponibilidad y estado de avance. |
| Intento y respuesta | Estudiante, actividad, tiempos, orden asignado, respuestas y estado de corrección. |
| Uso de potenciador | Actividad, estudiante, tipo y consumo; independiente de los intentos. |
| Entrega y versión | Actividad, estudiante, archivos y evaluación asociada a cada entrega. |
| Calificación | Resultado calculado o manual, máximo, peso y estado de publicación. |
| Incidencia | Señal registrada, contexto mínimo y revisión del docente. |

Definir los documentos, consultas e índices a partir de estos recorridos. Separar las consignas visibles de las soluciones y criterios que deben permanecer reservados. No enviar respuestas correctas ocultas dentro de los datos descargados por el estudiante.

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

El objetivo es probar cuatro actividades simultáneas con 50 estudiantes cada una, además de sus docentes. Medir consumo, respuestas persistidas, errores y tiempos bajo esa carga. Los umbrales de aceptación se fijarán antes de ejecutar la prueba; el objetivo no implica una capacidad ya demostrada.

Los mecanismos de clasificación y progreso deben respetar la configuración que oculta aciertos. Se resolverá esa combinación antes de publicar señales de puntuación o rachas que permitan deducir una corrección oculta.

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

Completar las reglas pendientes de la especificación que afecten a cada entrega: puntuación y redondeo, publicación de notas, preguntas dependientes, desempates, plazos de reentrega y datos visibles. Las decisiones técnicas inmediatas son almacenamiento de archivos, despliegue elegible, versiones, consultas, límites y eliminación periódica.

El orden de ejecución y la evidencia de finalización se mantienen en [tasks.md](tasks.md).
