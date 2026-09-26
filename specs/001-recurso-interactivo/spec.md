# 001 · Crear, compartir y responder un recurso interactivo

Estado: versión 1.0, base funcional definida el 26 de septiembre de 2026. Sin implementación ni pruebas ejecutadas.

## Resultado esperado

Un docente crea una materia, aprueba a un estudiante y publica un recurso que combina explicación y preguntas. El estudiante participa mediante una secuencia interactiva; el docente revisa las respuestas y publica la calificación. El recorrido completo funciona en celular y computadora, con datos persistentes y permisos comprobados.

Esta entrega concreta una primera parte de [la especificación general](../../specification.md). Las funciones posteriores permanecen en ese alcance. Los criterios de este archivo y de [aceptación](aceptacion.md) describen qué deberá comprobarse; no acreditan resultados.

## Base funcional

Se conservan las decisiones funcionales ya definidas: cuentas con correo y contraseña, materias con curso y año, ingreso mediante código y aprobación, borrador automático, publicación explícita, versiones, preguntas escritas de corrección manual, varios intentos en práctica, nota publicada por el docente y consulta individual.

Las decisiones D-01 a D-07 cierran los detalles operativos de esta entrega y se mantienen alineadas con la especificación general 1.0. Constituyen la base vigente para modelar e implementar; un cambio posterior se registra antes de modificar código o casos. No implican validación con usuarios ni resultados de pruebas.

## Alcance de la entrega

| Área | Incluido en 001 | Ampliaciones conservadas para entregas siguientes |
|---|---|---|
| Acceso y materias | Registro, acceso, recuperación, una función principal por cuenta, creación de materias, código y aprobación. | Retiro de integrantes y ciclo de archivo de 30 días. Cambio de perfil y baja automática no incluidos en 1.0. |
| Recursos | Biblioteca básica, búsqueda por título, títulos, texto, listas y un bloque de quiz por recurso; borrador, vista previa y versión publicada. | Imágenes, video enlazado, quizzes independientes, copias entre materias y organización adicional. |
| Preguntas | Selección de una respuesta y respuesta abierta escrita; puntos por pregunta; corrección automática o revisión manual. | Selección múltiple, verdadero/falso, relacionar, ordenar y completar con opciones o escritura. |
| Participación | Avance individual, disponibilidad por fechas, práctica o examen, intentos configurables, reconexión y tiempo configurable. | Avance guiado, mezcla, equipos, clasificación, rachas, sonidos y potenciadores. |
| Evaluación | Revisión manual, nota máxima configurable, publicación por estudiante, inclusión opcional en promedio y promedio ponderado básico. | Tareas con archivos, actividades externas, reentregas y gráficos. |
| Ayuda | Guía opcional por rol, omitir, repetir, estados vacíos y ayuda durante las tareas. | Ampliar los recorridos cuando se incorporen las funciones posteriores. |
| Calidad | Permisos, versiones, persistencia, teclado, adaptación de pantalla, estados de error y privacidad de resultados. | Informe de incidencias y prueba de capacidad completa de 200 estudiantes más docentes. |

La primera entrega debe presentar una experiencia interactiva cuidada. Los controles de funciones posteriores se incorporarán cuando funcionen; no se mostrarán opciones que simulen capacidades inexistentes. Esta división organiza la construcción y no redefine el producto final.

## Actores y permisos

| Operación | Docente propietario | Estudiante aprobado | Solicitud pendiente o rechazada | Otra cuenta o visitante |
|---|---|---|---|---|
| Configurar la materia y aprobar integrantes | Sí | No | No | No |
| Crear, leer o editar el borrador de un recurso | Sí | No | No | No |
| Leer la versión compartida en una materia activa | Sí | Sí | No | No |
| Iniciar o retomar un intento válido | Solo vista previa sin calificación | Sí, propio y dentro del plazo | No | No |
| Leer respuestas individuales | De su materia | Solo propias, con la visibilidad configurada | No | No |
| Leer soluciones y criterios de corrección | Sí | Solo cuando su publicación lo permita | No | No |
| Corregir y publicar una nota | Sí | No | No | No |
| Consultar notas publicadas | De su materia | Solo propias | No | No |

Los permisos se verifican también en las operaciones del servidor y en los datos. Ocultar un botón no impide una operación. Cambiar un identificador no puede dar acceso a otra materia, borrador, solución o nota. La vista previa no crea intentos de estudiantes ni consume oportunidades.

## Recorrido y reglas observables

### E1-01 · Cuenta y recuperación

- Registro: nombre visible, correo, contraseña y elección de docente o estudiante. No se necesita una cuenta institucional ni se presenta una afiliación verificada.
- D-01 establece confirmar el correo antes de crear materias o enviar solicitudes. El perfil principal queda fijo en esta primera entrega; una elección equivocada tiene un mensaje de ayuda y no habilita un cambio de permisos desde el cliente.
- El usuario puede cerrar sesión y recuperar acceso por correo. La recuperación presenta un mensaje genérico que no confirma a un visitante si una dirección tiene cuenta.
- Un enlace vencido o reutilizado no cambia la contraseña. La pantalla permite solicitar otro enlace. El proveedor de correo sigue pendiente en el plan técnico.
- Los campos admiten pegado y gestores de contraseñas; los errores se asocian a sus campos.

### E1-02 · Materia e incorporación

- El docente crea la materia con nombre, curso y año. Puede crear dos materias con el mismo nombre y detalles diferentes; sus integrantes y resultados permanecen separados.
- D-02 establece un código aleatorio de ocho caracteres sin caracteres ambiguos. Permanece vigente hasta que el docente lo renueva o desactiva; no se interpreta como una contraseña de acceso al contenido.
- Al introducir un código válido, el estudiante confirma la materia de destino y envía una solicitud. Antes de su aprobación solo ve datos mínimos para identificarla y el estado de su solicitud.
- Una solicitud pendiente repetida no genera duplicados. El docente aprueba o rechaza. Tras rechazo se permite una nueva solicitud con el código vigente, con límites de frecuencia; la decisión anterior queda registrada para el docente.
- Renovar el código impide nuevas solicitudes con el anterior. No revoca aprobaciones ni solicitudes ya presentadas. Un código inválido o desactivado produce el mismo mensaje de código no disponible.
- La aprobación repetida es idempotente: no crea dos integrantes ni afecta otras materias. El código nunca sustituye la cuenta ni la aprobación.

### E1-03 · Borrador y edición por bloques

- El recurso tiene propietario, título y bloques ordenados. El docente añade, edita, elimina y reordena bloques. El arrastre tiene alternativa mediante controles de mover arriba y abajo.
- El guardado automático conserva el último borrador confirmado. La interfaz distingue guardando, guardado y problema de guardado. Una confirmación positiva corresponde a persistencia real.
- D-03 establece guardar tras un segundo sin cambios y conservar una revisión del borrador. Si otra pestaña lo ha modificado, no se sobrescribe silenciosamente: se permite recargar o conservar una copia de lo pendiente.
- La vista previa muestra la experiencia del estudiante usando datos del borrador y permite volver al editor. No comparte contenido ni crea una evaluación.
- Publicar requiere título y contenido válidos. Un recurso solo de lectura no exige quiz ni crea una calificación. Si incluye quiz, este requiere al menos una pregunta, valor positivo por pregunta y una solución válida para cada pregunta automática. Una pregunta abierta incluye una guía de corrección visible solo para el docente.
- El sistema señala el bloque que impide publicar, conserva el borrador y mueve el foco de manera comprensible al error.

### E1-04 · Versiones y publicación

- Publicar crea una versión identificable e inmutable y permite asignarla a una materia propia. Guardar el borrador no modifica lo que ven los estudiantes.
- La actividad fija versión del recurso, preguntas, soluciones, valores y reglas. Cada intento conserva esa referencia y el orden de presentación.
- D-04 establece bloquear cambios de contenido y reglas de evaluación de una actividad desde el inicio de su primer intento. Editar el recurso crea un nuevo borrador; publicar esa edición y usarla después requiere otra actividad. La ampliación autorizada del plazo es una excepción explícita, registrada y sin cambiar las preguntas.
- Antes del primer intento se puede sustituir la versión o configuración de la actividad, con una operación que no compita con un inicio: el intento utiliza íntegramente la versión anterior o la nueva, nunca una mezcla.
- El docente ve qué versión utiliza una actividad. Una edición no cambia respuestas, puntuación ni evidencia ya vinculadas a una versión anterior.

### E1-05 · Configuración comprensible

El formulario principal muestra nombre, materia, práctica o examen, nota máxima, si cuenta para el promedio y disponibilidad. La sección avanzada reúne intentos, tiempo, corrección manual, retroalimentación y peso. El resumen previo permite revisar las reglas efectivas antes de publicar y antes de que el estudiante comience.

D-05 establece estos valores iniciales, todos editables por el docente antes de que empiece la actividad:

| Configuración | Práctica | Examen |
|---|---|---|
| Intentos | Tres; conserva el mejor resultado completo. | Uno. |
| Nota máxima | 100. | 100. |
| Cuenta para promedio | Desactivado. | Activado. |
| Peso, cuando cuenta | 1. | 1. |
| Tiempo del intento | Sin límite propio; respeta cierre de actividad. | Sin límite propio; respeta cierre de actividad. |
| Respuestas cerradas | Corrección automática. | Corrección automática. |
| Mostrar acierto y explicación | Después de responder. | Tras cierre de actividad y publicación de la revisión. |

D-05 establece apertura inmediata y cierre obligatorio elegible por el docente. Apertura, cierre y ampliaciones se muestran en la zona horaria de la actividad. La elección de zona debe ser explícita al configurar, con un valor inicial tomado del dispositivo; las fechas se conservan sin depender del reloj del estudiante.

Los intentos son enteros positivos. Máximo y peso son números positivos; una actividad que no cuenta mantiene su resultado visible al publicarse pero queda fuera del promedio. La opción de ocultar retroalimentación tiene prioridad sobre cualquier señal que pueda revelar aciertos.

### E1-06 · Participación interactiva

- Un estudiante aprobado abre el recurso, lee sus explicaciones y ve las reglas antes de comenzar el quiz. El inicio válido crea un intento; abrir la página por sí solo no consume uno.
- Se presenta una pregunta a la vez, con progreso comprensible. Elegir una opción no envía automáticamente: el botón Responder confirma la elección y evita envíos accidentales. En respuestas abiertas, el mismo botón envía el texto terminado.
- D-06 establece que una respuesta confirmada sea definitiva dentro del intento. Antes de enviarla se puede cambiar la selección o el texto. Repetir la actividad consume otro intento disponible.
- Con aciertos ocultos, la respuesta confirmada lleva directamente a la siguiente pregunta. No aparece una pantalla intermedia de «Respuesta guardada». Con retroalimentación inmediata, se muestra acierto/error y explicación, y se continúa con una acción clara; no se fuerza un tiempo de lectura.
- Una respuesta escrita avanza sin afirmar acierto o error. La revisión pendiente se informa al finalizar y en resultados.
- Si el envío falla, la interfaz conserva la respuesta pendiente y permite reintentar. No avanza fingiendo que está guardada. Un envío cuya confirmación se perdió se recupera sin duplicar la respuesta.
- Al responder la última pregunta se cierra el intento. No hay un segundo envío global que permita reemplazar las respuestas ya confirmadas.

### E1-07 · Reconexión, intentos y tiempo

- Existe como máximo un intento abierto por estudiante y actividad. Dos pestañas que intenten iniciarlo reciben el mismo intento, sin consumir dos oportunidades.
- Recargar o reconectar conserva las respuestas confirmadas, el orden, el intento y su plazo. No se garantiza recuperar una edición local que nunca llegó al servidor después de cerrar el navegador.
- El plazo efectivo es el menor entre el cierre de la actividad y el inicio más la duración configurada, considerando las ampliaciones autorizadas. Sin duración propia, rige el cierre de actividad.
- D-06 establece un aviso accesible cuando resta un minuto, o inmediatamente si el plazo restante inicial es menor. Un intento empieza solo si el servidor confirma que todavía hay tiempo.
- Al vencer el plazo se cierra el intento, se conservan respuestas confirmadas y las preguntas sin respuesta reciben cero. Las respuestas escritas recibidas siguen pendientes de corrección. Una solicitud recibida después del plazo no se acepta aunque el reloj del dispositivo indique otra hora.
- Retomar un intento abierto no consume otro. Uno cerrado consume una oportunidad, incluso si no se respondió. Un fallo anterior a crear el intento no la consume.
- El docente puede ampliar un plazo antes del cierre; la ampliación respeta el cierre general o exige ampliar también ese cierre. Se informa al estudiante y se registra el cambio. No se reabre automáticamente un intento cerrado.

### E1-08 · Corrección y cálculo

- Selección de una respuesta: acierto = valor completo; error = cero. La corrección manual configurable deja esa pregunta pendiente hasta que el docente la evalúa.
- Respuesta escrita: siempre manual, con nota entre cero y su valor máximo y comentario opcional. Una coincidencia de texto no la convierte en corrección automática.
- D-07 establece calcular la nota como `suma de puntos obtenidos / suma de máximos × máximo de actividad`, con decimales exactos y redondeo final a dos decimales, mitad hacia arriba. No redondear cada paso intermedio.
- Un intento abierto o con respuestas pendientes de revisión no tiene nota final. El docente puede ver puntos parciales identificados como tales; no se muestran como nota definitiva ni se incorporan al promedio.
- Ejemplo: valores 2, 3 y 5; resultados 2, 0 y 4; máximo de actividad 20. La nota es `6 / 10 × 20 = 12`. Si la tercera respuesta sigue pendiente, aún no hay nota final.
- D-07 establece seleccionar el mejor intento completamente corregido. Mientras otro intento esté pendiente se indica esa situación. La nota que ya fue publicada se mantiene hasta una nueva publicación explícita; completar un intento no cambia por sí solo lo publicado.
- Las bonificaciones no se aplican en esta entrega. Su efecto configurable, límites y usos por actividad siguen en RF-06 y RF-07 del alcance general.

### E1-09 · Publicación y promedio

- El docente revisa la evaluación y publica la nota de cada estudiante que ya tenga un resultado completo. No se exige corregir a toda la clase para publicar una nota individual.
- Cada estudiante solo ve sus notas publicadas. Corregir las puntuaciones de preguntas recalcula la nota del quiz; no se reemplaza arbitrariamente el total. Si había nota publicada, la corrección crea una revisión privada con motivo; la anterior sigue visible hasta republicar. Se conservan autor, fecha, valores anterior y nuevo.
- El promedio incluye únicamente la última evaluación publicada de actividades marcadas para contar. D-07 establece `100 × suma((nota / máximo) × peso) / suma(pesos incluidos)` y redondeo final a dos decimales.
- Ejemplo: 12/20 con peso 2 y 90/100 con peso 1 producen 70/100. Una tercera actividad sin nota publicada no añade peso ni equivale a cero. Una nota cero publicada sí cuenta.
- D-07 establece mostrar «Sin calificaciones publicadas» cuando el denominador es cero. El promedio agrupa resultados de una materia; no se mezclan materias o años.
- Cambiar máximo, peso o inclusión después del primer intento queda bloqueado por D-04. La modificación posterior de ponderaciones será una ampliación que necesitará reglas específicas.

### E1-10 · Información oculta

- Mientras la corrección deba permanecer oculta, no se entregan soluciones, puntos por pregunta, porcentajes de acierto ni explicaciones reservadas al navegador del estudiante. La nota agregada publicada explícitamente por el docente sí es visible a su titular, sin desglose de respuestas. Tampoco se filtran mediante exportaciones, respuestas de error o campos de recursos.
- Se puede mostrar avance: preguntas respondidas y cantidad de preguntas. Este indicador no depende de los aciertos.
- La publicación de la calificación y la apertura de la revisión son estados distintos. En el modo «tras cierre y publicación», la revisión requiere ambas condiciones; publicar una nota antes del cierre no libera soluciones.
- Si el docente elige ocultar siempre los aciertos, publicar la nota no revela respuestas correctas ni explicaciones reservadas.
- Las rachas, bonificaciones y clasificaciones de entregas posteriores se rigen por JU-01 a JU-08 de la especificación general y deben respetar estas restricciones.

### E1-11 · Ayuda inicial y contextual

- Al entrar por primera vez tras confirmar correo, ofrecer Conocer Aulify y Ahora no. Hasta cinco pasos por recorrido, con opción de cerrar, retroceder y volver a abrir desde Ayuda.
- Docente: materia, invitaciones/aprobación, recurso, publicación y revisión. Estudiante: código, espera de aprobación, actividad, participación y resultado publicado. Si falta una función o elemento, orientar sin apuntar a controles inexistentes.
- Conservar preferencia por cuenta, rol y versión; no repetir automáticamente al iniciar sesión o cambiar dispositivo. Una nueva guía ofrece invitación discreta.
- Avanzar en la guía no crea ni publica datos, no consume intentos ni envía respuestas. Las demostraciones se identifican con datos ficticios.
- No superponer tutorial durante un intento; la ayuda disponible es estática y no altera plazos. Cerrar devuelve foco al control de origen. Teclado, lector de pantalla, movimiento reducido y disposición móvil comprobables.
- Omitir la guía no limita funciones. Estados vacíos con siguiente acción y explicación de términos permanecen disponibles. Reglas generales AY-01 a AY-04.

## Estados del dominio

| Objeto | Estados | Transiciones y límites |
|---|---|---|
| Solicitud | Pendiente, aprobada, rechazada | El docente decide; una nueva solicitud tras rechazo inicia otro evento, sin dos solicitudes pendientes. |
| Recurso | Borrador y versiones publicadas | Un borrador mutable puede coexistir con varias versiones publicadas inmutables. |
| Actividad | Borrador, programada, abierta, cerrada | Publicar configura disponibilidad; la hora de servidor determina apertura y cierre. El retiro o cierre anticipado no forma parte de 001. |
| Intento | En curso, cerrado por envío, cerrado por vencimiento | Un cerrado no vuelve a en curso; retomar conserva el mismo intento abierto. |
| Corrección del intento | Pendiente, completa | Independiente de estar cerrado; una respuesta manual impide considerar completa la corrección. |
| Evaluación del estudiante | Sin publicación o versión publicada; puede haber revisión pendiente | Un nuevo borrador de evaluación no reemplaza la versión publicada. |
| Ayuda | Sin ofrecer, ofrecida, omitida o completada | Estado por cuenta, rol y versión; siempre reabrible. |

Estado de intento, corrección y publicación no deben almacenarse como un único estado ambiguo. Un intento puede estar cerrado, tener revisión pendiente y coexistir con una calificación anterior publicada para la actividad.

## Experiencia y criterios de calidad

Las pantallas a diseñar son acceso/recuperación, inicio y ayuda por rol, materia e integrantes, biblioteca, editor/vista previa, configuración/resumen, participación y revisión/resultados. Cada una necesita estados vacío, carga, error y permisos insuficientes cuando correspondan. La participación añade desconexión, vencimiento y finalización.

Criterios definidos para 001:

- Recorridos completos a 360 × 800 y 1440 × 900 píxeles CSS; revisión de redistribución a 320 píxeles y texto al 200 %, sin pérdida de acciones o contenido esencial.
- Interacción por teclado en acceso, solicitudes, editor, preguntas y revisión; orden de foco predecible, visible y sin trampas. Al avanzar de pregunta se anuncia su título y posición sin leer toda la pantalla nuevamente.
- Contraste mínimo aplicable, etiquetas, mensajes asociados a campos y estados comprensibles sin depender solo del color. El contraste real se medirá al seleccionar la paleta.
- Controles táctiles con objetivo de diseño de 44 × 44 píxeles CSS; comprobar criterios aplicables, excepciones y espaciado. La marca no obliga a usar verde claro para texto.
- Transiciones breves que respeten reducción de movimiento. El acceso y el quiz siguen operables sin animación ni sonido.
- Ninguna respuesta confirmada se pierde o se duplica en los casos de reintento definidos en aceptación. Las pruebas negativas de permisos son obligatorias.
- Medir los criterios aplicables del [plan de calidad](../../docs/calidad/plan-de-calidad.md); sus umbrales se fijaron antes de ejecutar. La primera entrega no acredita 200 estudiantes concurrentes.

Referencia: [WCAG 2.2](https://www.w3.org/TR/WCAG22/). La revisión abarcará criterios A y AA aplicables, incluidos reflujo, foco, autenticación accesible y ajuste de tiempo. Los objetivos anteriores no constituyen una declaración de conformidad ni sustituyen la evaluación completa. La configuración de tiempo deberá permitir adaptaciones suficientes; un aviso de vencimiento no resuelve por sí solo la accesibilidad.

## Decisiones operativas vigentes

| ID | Decisión | Motivo | Afecta |
|---|---|---|---|
| D-01 | Confirmar correo y mantener un perfil principal fijo durante 001. | Recuperación coherente y permisos explícitos. | Acceso, modelo de perfiles y correo. |
| D-02 | Código de ocho caracteres, sin caducidad automática; renovación o desactivación docente. | Ingreso sencillo con aprobación obligatoria. | Invitaciones y protección frente a intentos repetidos. |
| D-03 | Autosave tras un segundo y control de revisión para no sobrescribir otro borrador. | Evitar pérdida silenciosa al editar. | Editor y persistencia. |
| D-04 | Congelar contenido y evaluación desde el primer intento; permitir ampliación de plazo registrada. | Conservar equivalencia de preguntas y notas. | Versionado y operaciones simultáneas. |
| D-05 | Tres intentos en práctica, uno en examen; práctica fuera del promedio inicialmente; cierre obligatorio. | Valores iniciales comprensibles, editables antes de comenzar. | Configuración y disponibilidad. |
| D-06 | Respuesta definitiva al confirmar, sin retroceso editable; aviso de plazo al minuto. | Interacción continua y regla de envío clara. | Participación y accesibilidad. |
| D-07 | Fórmula proporcional, dos decimales, mejor intento completo y publicación versionada. | Resultados reproducibles sin convertir pendientes en ceros. | Evaluación y promedio. |

## Condición de finalización

Implementar los recorridos y verificar todos los casos de [aceptación](aceptacion.md). Mantener vinculados el modelo y las migraciones, decisiones de diseño, cambios de código y evidencia. Registrar cualquier caso fallido o no ejecutado. La existencia de este spec no completa una tarea de implementación.
