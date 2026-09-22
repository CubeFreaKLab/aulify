# Especificación de Aulify

**Estado: borrador 0.8.**

Este documento describe el comportamiento del producto y las reglas pendientes. El propósito y alcance general se encuentran en [producto y vocabulario](docs/producto.md); los principios de desarrollo, en [principios](docs/principios.md).

## Estado de las reglas

- **Definido:** comportamiento incluido en el alcance funcional.
- **Propuesto:** detalle de diseño o comprobación todavía sujeto a evaluación.
- **Pendiente:** decisión necesaria para completar un requisito.

Los criterios de comprobación son propuestas para verificar el producto; no representan pruebas ejecutadas.

## Recorridos principales

### Docente

Se registra con correo y contraseña y elige su perfil. Crea una materia, configura su curso y año y comparte un código de invitación. Aprueba el ingreso de los estudiantes.

Prepara recursos por bloques desde su biblioteca personal, con guardado automático como borrador, vista previa y publicación explícita. Puede crear un quiz independiente o incorporarlo a un recurso con explicaciones, y duplicarlo para otra materia con edición separada. Las modificaciones conservan la versión asociada a respuestas existentes.

Configura quizzes de práctica o examen, publica tareas o registra actividades de calificación manual. Revisa respuestas y entregas, publica notas y consulta gráficos con filtros.

### Estudiante

Se registra con correo y contraseña y elige su perfil. Solicita incorporarse a una materia mediante código y espera la aprobación del docente.

Participa en quizzes y entrega archivos. Puede completar actividades autónomas durante sus fechas de disponibilidad y retomar el mismo intento tras una desconexión, respetando el plazo configurado.

Consulta sus calificaciones cuando el docente las publica. La clasificación del quiz, si está habilitada, puede mostrarse provisional mientras falta corrección manual.

## Requisitos por área

| ID | Comportamiento definido | Criterio de comprobación propuesto | Detalles pendientes |
|---|---|---|---|
| RF-01 | Registro con correo y contraseña, recuperación por correo y elección del perfil | La cuenta puede iniciar sesión y recuperar su acceso. Las acciones disponibles corresponden a sus permisos. | Verificación de correo, cambios de perfil y cierre de cuenta. |
| RF-02 | Materias separadas por grupo, con curso y año configurables; ingreso por código y aprobación; archivo recuperable durante 30 días | Una solicitud no permite participar hasta ser aprobada. La materia archivada se puede restaurar durante 30 días; después se elimina con sus notas y entregas. La biblioteca independiente se conserva. | Vigencia de códigos, retiro de integrantes y ejecución verificable de la eliminación. |
| RF-03 | Editor con títulos, texto, listas, imágenes, videos mediante enlaces y preguntas; borrador automático, vista previa y publicación | Los cambios guardados se recuperan al reabrir. La vista previa permite comprobar la presentación antes de publicar. | Formatos de contenido, conflictos de guardado y límites de archivos. |
| RF-04 | Biblioteca personal; quiz independiente o integrado; copias entre materias y versiones utilizadas conservadas | Una copia se edita sin cambiar el original. Modificar un recurso no altera consignas ni criterios asociados a respuestas existentes. | Organización y búsqueda en la biblioteca, edición concurrente. |
| RF-05 | Avance guiado o individual, disponibilidad autónoma, intentos y tiempo configurables | La práctica conserva el mejor resultado entre varios intentos como configuración inicial; el examen tiene uno. El tiempo puede desactivarse o ampliarse. La reconexión retoma el mismo intento dentro del plazo. Al vencer el tiempo se conservan las respuestas guardadas y se cierra el intento, con aviso previo. | Cantidad inicial de intentos de práctica y duración del aviso. |
| RF-06 | Presentación visual, rachas, sonidos desactivables, equipos, clasificación y potenciadores habilitados por el docente | Cada estudiante puede usar una pista y un doble en toda la actividad; repetir un intento no recupera usos. Un potenciador deshabilitado no se puede usar. El doble se activa antes de enviar y multiplica los puntos obtenidos; un error sigue valiendo cero. La pista no resta puntos por defecto. La clasificación es provisional mientras falta corrección. | Desempates, cambios de equipo con actividad iniciada y cálculo provisional. |
| RF-07 | Quiz de práctica o examen con valor máximo, valor por pregunta y efecto de bonificaciones configurables | La nota no supera el máximo de la actividad. Toda respuesta escrita requiere revisión manual. La corrección automática respeta las reglas por tipo de pregunta. No hay descuento por error de forma predeterminada. | Conversión detallada de puntos con bonificaciones y redondeo. |
| RF-08 | Notas publicadas por el docente, consulta individual y promedio ponderado sobre 100 | Cada estudiante consulta sus notas publicadas. Lo pendiente de corrección se excluye del promedio y se indica claramente. Una tarea no entregada requiere una decisión de calificación del docente. | Tratamiento de notas corregidas aún sin publicar, periodos y correcciones posteriores. |
| RF-09 | Reporte de posibles irregularidades para evaluación del docente | Las incidencias muestran su contexto y no provocan una sanción automática. La decisión del docente se distingue de las señales detectadas. | Controles técnicos, datos conservados y acciones para resolver incidencias. |
| RF-10 | Tareas con PDF, Word e imágenes, fecha configurable, nota y comentario manuales; reentrega de tareas calificadas habilitada por el docente | El estudiante puede reemplazar una entrega sin calificar antes del cierre. Después de calificar, una reentrega requiere habilitación docente y conserva el archivo y evaluación anteriores. La nueva nota sustituye a la publicada cuando el docente publica la nueva evaluación. Las entregas posteriores al plazo permitidas se marcan como tardías. | Tamaños, cantidad y formatos concretos de archivos; disponibilidad de reentrega. |
| RF-11 | Actividades de calificación manual | El docente crea la actividad, define su valor y registra la nota de cada estudiante. La publicación sigue el procedimiento de calificaciones. | Edición posterior y datos adicionales de una actividad externa. |
| RF-12 | Evolución individual, distribución de notas por actividad y estado de entregas, con tablas y filtros | Los gráficos y sus tablas reflejan los mismos datos y filtros de materia, curso y año. Los resultados pendientes son identificables. | Ejes, periodos de comparación y agrupación del análisis entre materias. |
| RF-13 | Selección de respuestas, verdadero/falso, relaciones, secuencias, respuestas abiertas y espacios para completar | Cada tipo permite construir y responder su consigna. Se distinguen los espacios con opciones de los que requieren escritura. | Valor por espacio y criterio de corrección manual. |
| RF-14 | Mezcla configurable según el ritmo | En modo guiado todos reciben la pregunta abierta por el docente y se pueden mezclar opciones. En avance individual se puede mezclar el orden del mismo conjunto de preguntas y opciones. | Tratamiento de preguntas dependientes y explicaciones al mezclar. |
| RF-15 | Retroalimentación configurable y transición según el modo de avance | En modo individual y con la corrección oculta se pasa a la siguiente pregunta sin confirmación de guardado. En modo guiado se muestra el progreso grupal hasta que el docente abra la siguiente pregunta, sin revelar aciertos ocultos. Las respuestas escritas se revisan manualmente y su estado se indica en los resultados. | Compatibilidad de puntos, rachas y clasificación con ocultar aciertos. |
| RF-16 | Opciones principales, configuración avanzada desplegable y resumen previo | El formulario inicial muestra nombre, materia, práctica o examen, valor y disponibilidad. Los detalles se encuentran en la configuración avanzada. Antes de iniciar se presenta un resumen de las reglas activas. | Organización final de controles y opciones según modalidad. |
| RNF-01 | Buena experiencia responsive para ambos roles | Preparar, participar y revisar se pueden completar en celular y computadora. Las tablas y controles se adaptan al espacio disponible. | Navegadores y tamaños objetivo, límites de conectividad y rendimiento. |
| RNF-02 | Usabilidad y accesibilidad prioritarias | Las acciones y estados tienen nombres comprensibles. Se verifican teclado, foco, etiquetas, contraste, lectura, movimiento y tiempo. | Criterios medibles y procedimiento de evaluación de uso. |
| RNF-03 | Objetivo de carga de 50 estudiantes por actividad y cuatro actividades simultáneas | Ejecutar una prueba con 200 cuentas de prueba distribuidas entre cuatro actividades, además de las sesiones docentes. Registrar errores, tiempos, persistencia de respuestas y consumo de servicios. | Umbrales de aceptación y configuración del entorno. Es un objetivo de prueba, todavía sin capacidad validada. |
| RNF-04 | Inicio con planes gratuitos de servicios | El despliegue inicial identifica plan, elegibilidad, cuotas y respuesta al agotamiento. No activa un plan con facturación como parte del inicio gratuito. | Viabilidad de Supabase Free bajo carga, proveedor de correo, transporte de sincronización y alojamiento. La selección técnica y los costos están en plan.md y docs/costos-servicios.md. |

## Organización y publicación de recursos

Cada materia corresponde a un grupo con sus detalles de curso y año. El mismo formulario permite crear materias para grupos distintos.

El editor guarda cambios automáticamente como borrador. La vista previa permite revisar el recurso y la publicación requiere una acción explícita. Cuando una actividad tiene respuestas, se conserva su versión utilizada para mantener coherentes consignas, respuestas y resultados.

La biblioteca personal del docente reúne sus recursos y quizzes. Permite crear un quiz independiente o incorporarlo a un recurso con explicaciones. Reutilizarlo en otra materia genera una copia independiente que se edita por separado.

### Archivado de materias

El docente puede archivar una materia y restaurarla durante los 30 días siguientes al archivado. Al vencer el plazo, se eliminan la materia y sus datos asociados, incluidas notas y entregas. Los recursos independientes de la biblioteca se conservan.

El plan técnico debe precisar la eliminación de registros y archivos vinculados a la materia y su relación con los respaldos. La eliminación de una materia no elimina las cuentas de sus integrantes ni los datos de otras materias.

## Corrección de respuestas

El valor de cada pregunta es configurable. Las preguntas cerradas admiten corrección automática y el quiz puede configurarse para revisión manual.

| Tipo | Regla definida | Detalle pendiente |
|---|---|---|
| Selección de una respuesta y verdadero/falso | Corrección automática disponible según la respuesta correcta; acierto y explicación sujetos a configuración | Compatibilidad con señales de puntuación cuando se oculta la retroalimentación. |
| Selección múltiple | Se requiere acertar el conjunto completo | Mensajes para selecciones incompletas. |
| Relacionar elementos | Puntos por cada elemento correcto | Distribución del valor entre elementos. |
| Ordenar secuencias | Puntos por cada elemento correctamente ubicado | Distribución del valor entre posiciones. |
| Completar con opciones | Corrección automática disponible | Valor de cada espacio. |
| Completar escribiendo palabras | Corrección manual obligatoria | Criterio y valor de cada espacio. |
| Respuesta abierta escrita | Corrección manual obligatoria | Guía de corrección. |
| Tarea con archivos | Nota y comentario manuales; reentrega después de calificar habilitada por el docente, conservando versiones anteriores | Disponibilidad y plazo de reentrega. |
| Actividad manual | Nota registrada por el docente | Datos complementarios de evaluación. |

No se descuentan puntos por error de forma predeterminada. Una respuesta escrita no se corrige automáticamente por coincidencia de texto.

### Retroalimentación

El docente configura si se muestra que una respuesta cerrada fue correcta o incorrecta. Puede ocultar esta indicación. Cuando se muestre, el color se acompaña de texto o iconos para que el significado no dependa solo de él.

La configuración inicial de práctica muestra la respuesta correcta y su explicación después de responder. En examen se muestran después del cierre y cuando el docente publica la revisión. La visibilidad es configurable; no se fuerza una indicación inmediata si se ha desactivado.

El quiz mantiene la continuidad de la interacción. En avance individual, cuando la corrección está oculta, completar una respuesta lleva directamente a la siguiente pregunta; no se muestra «Respuesta guardada» ni una confirmación intermedia de recepción.

En modo guiado, quien ya respondió pasa mediante una transición breve a una vista del progreso grupal. La siguiente pregunta aparece cuando el docente la abre. Esta vista no revela aciertos si la corrección está oculta.

Las respuestas escritas no anuncian automáticamente acierto o error. Su estado pendiente de corrección se muestra en los resultados, sin interrumpir cada transición del quiz. Sigue por concretar la compatibilidad de las demás señales lúdicas con ocultar los aciertos.

## Calificaciones y promedios

- El docente define el valor máximo de la actividad y si las bonificaciones cuentan para la nota.
- La nota no supera el máximo configurado.
- En práctica, la configuración inicial conserva el mejor resultado entre los intentos disponibles.
- El docente publica las calificaciones cuando están listas. Cada estudiante consulta las suyas.
- Los resultados pendientes de corrección quedan fuera del promedio y se identifican claramente.
- Una tarea no entregada no se convierte automáticamente en cero: requiere una decisión del docente.
- Para promediar, las actividades se normalizan y utilizan pesos configurables. El resultado se presenta sobre 100.

Propuesta de fórmula: dividir la nota final de cada actividad por su máximo, multiplicar por su peso, sumar estos resultados, dividir por la suma de los pesos incluidos y multiplicar por 100. Quedan pendientes el redondeo, el caso sin actividades calificadas y el tratamiento de notas corregidas todavía sin publicar.

## Configuración e interacción

| Combinación | Regla definida o pendiente |
|---|---|
| Avance guiado y mezcla | Todos responden la pregunta que abre el docente; se pueden mezclar sus opciones. Quien termina ve el progreso grupal, con aciertos ocultos si corresponde, hasta que el docente abre la siguiente pregunta. |
| Avance individual y mezcla | Se puede variar el orden del mismo conjunto de preguntas y sus opciones. Preservar preguntas dependientes y explicaciones es una propuesta por concretar. |
| Actividad autónoma | Se publica con apertura y cierre para completarse sin que el docente esté conectado. |
| Intentos | Configurables; varios en práctica con conservación del mejor resultado, uno en examen como valores iniciales. |
| Tiempo y desconexión | El tiempo puede desactivarse o ampliarse. Se retoma el mismo intento dentro del plazo configurado. Antes del vencimiento se avisa; al vencer se cierra el intento conservando las respuestas guardadas. El docente puede conceder tiempo adicional antes del cierre. Las respuestas escritas pasan a revisión manual. |
| Corrección pendiente y clasificación | La clasificación se identifica como provisional y pasa a definitiva tras completar la corrección. Su visibilidad para participantes es configurable. |
| Doble puntuación | Disponible solo si el docente lo habilita. Se activa antes de enviar y duplica los puntos obtenidos en esa pregunta; una respuesta incorrecta sigue valiendo cero. El docente decide si cuenta para la nota, sin superar su máximo. Un uso por estudiante para toda la actividad; los nuevos intentos no recuperan el uso consumido. |
| Pista | Disponible solo si el docente la habilita; preparada por él para la pregunta. No resta puntos por defecto. Un uso por estudiante para toda la actividad, independiente del uso del doble; los nuevos intentos no recuperan el uso consumido. |
| Equipos | Reparto automático y ajustes por el docente. Respuestas y notas individuales. La clasificación del equipo utiliza el promedio de las puntuaciones de sus integrantes. |
| Identidad y desempate | Pendientes los datos visibles en la clasificación, los desempates y el cálculo provisional cuando falta corrección. |

La mezcla aleatoria puede producir órdenes coincidentes entre estudiantes. Su funcionamiento no implica garantizar un orden único para cada participante ni seleccionar conjuntos distintos desde un banco de preguntas.

### Presentación de la configuración

El formulario inicial muestra nombre, materia, propósito de práctica o examen, valor y disponibilidad. Una sección de configuración avanzada desplegable reúne tiempo, intentos, equipos, potenciadores, visibilidad de respuestas, clasificación y controles adicionales. Antes de iniciar se presenta un resumen de las reglas activas.

### Reentrega de una tarea calificada

El docente habilita la reentrega. Se conservan el archivo y la evaluación anteriores; la nueva entrega queda pendiente de corrección. La calificación publicada se mantiene hasta que el docente publica la nueva evaluación. El estado de la entrega permite identificar ambas versiones.

## Experiencia y accesibilidad

Los siguientes detalles de diseño son propuestas para comprobar la experiencia:

1. Mostrar el estado de guardado en el editor y de envío en las tareas. En el quiz, mantener la transición continua e informar cuando un problema requiere una acción para continuar.
2. Mostrar la corrección pendiente de respuestas escritas en los resultados, sin introducir una confirmación de recepción entre preguntas.
3. Explicar las reglas de puntos y su relación con la nota antes de comenzar.
4. Permitir ordenar bloques mediante controles utilizables con teclado y táctil, además del arrastre.
5. Acompañar acierto, error y conexión con texto o iconos identificables, además del color.
6. Permitir reducir el movimiento y desactivar sonidos.
7. Acompañar los gráficos con tablas que presenten los mismos datos.
8. Hacer configurables las adaptaciones de tiempo sin perder claridad sobre el plazo del intento.

Como referencia se utiliza [WCAG 2.2 del W3C](https://www.w3.org/TR/WCAG22/): uso del color (1.4.1), teclado (2.1.1), tiempo ajustable (2.2.1), movimiento automático (2.2.2), foco visible (2.4.7) y mensajes de estado (4.1.3). Reducir animaciones de interacción se relaciona además con 2.3.3, de nivel AAA. La conformidad requiere comprobar los criterios aplicables.

## Controles contra trampas

Los controles generan información para evaluación del docente dentro de la plataforma. Una incidencia no aplica una sanción automática.

La mezcla de preguntas y opciones es configurable. Como propuestas técnicas adicionales se contemplan comprobar permisos e intentos, controlar la publicación de soluciones y validar en el servidor las reglas y resultados.

La [API de visibilidad de la página](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) informa si el documento está visible u oculto. Inferencia técnica: esa señal no revela qué contenido se consulta, la intención del estudiante ni el uso de otro dispositivo. Su registro, datos y presentación están pendientes.

La [solicitud de pantalla completa](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) requiere interacción del usuario, puede fallar y permite salir. Su inclusión y alternativa accesible siguen pendientes; no equivale a bloquear el equipo.

## Decisiones pendientes

| Área | Decisiones por concretar |
|---|---|
| Cuentas y materias | Verificación de correo, cambios de perfil, vigencia de códigos, retiro de integrantes y ejecución de la eliminación después del archivo. |
| Recursos | Organización y búsqueda en la biblioteca, edición concurrente y preguntas relacionadas al mezclar. |
| Puntuación | Distribución por elementos, fórmula con bonificaciones y redondeo. |
| Calificaciones | Cálculo sin resultados, notas corregidas sin publicar, periodos y cambios posteriores. |
| Sesiones y equipos | Número inicial de intentos de práctica, duración del aviso de vencimiento, empates y cambios de equipo. |
| Entregas | Límites y formatos concretos de archivos, disponibilidad de reentrega. |
| Reportes | Información visible cuando se ocultan aciertos, identidad en clasificación, periodos y agrupación de gráficos, acciones sobre incidencias. |
| Calidad y datos | Objetivos verificables de usabilidad, accesibilidad y rendimiento, conservación de información y respaldo. |
| Implementación | Arquitectura, tecnologías, versiones, despliegue y verificaciones. |

## Alcance adicional

Asistencia, matrícula institucional, portal familiar, mensajería y boletines oficiales no forman parte del alcance definido.

El [plan técnico](plan.md) presenta la propuesta de arquitectura y sus comprobaciones pendientes. Las [tareas](tasks.md) se derivan de los requisitos y sus criterios verificables.
