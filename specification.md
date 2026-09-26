# Especificación de Aulify

**Versión 1.0 · Base funcional para modelado y desarrollo · 26 de septiembre de 2026.**

Esta versión consolida el comportamiento previsto. Sus reglas son la base de implementación; no describen funciones ya construidas. Un cambio posterior debe actualizar su regla, sus casos de aceptación y su decisión asociada. Los proveedores, el esquema físico, las bibliotecas y la presentación visual se concretan en el [plan técnico](plan.md).

El propósito, actores y vocabulario están en [producto](docs/producto.md); los criterios generales, en [principios](docs/principios.md). La [entrega 001](specs/001-recurso-interactivo/spec.md) desarrolla el primer recorrido. Las ampliaciones tienen [casos de aceptación](specs/aceptacion-producto.md) y conservan su lugar en las [tareas](tasks.md).

## 1. Propósito y alcance

Un docente de secundaria prepara un recurso con explicaciones y preguntas, lo comparte con una materia, sus estudiantes participan y él revisa respuestas y publica resultados. El editor por bloques y la interacción del quiz son el centro del producto. Materias, tareas, notas y seguimiento los complementan.

La experiencia funciona en celular y computadora, en español, con controles comprensibles, adaptaciones de accesibilidad y recuperación ante fallos. No exige una cuenta institucional. Elegir un perfil al registrarse no acredita una identidad institucional.

Asistencia, matrícula institucional, portal familiar, mensajería, boletines oficiales, videoconferencia, supervisión con cámara, navegador bloqueado, corrección automática de escritura y colaboración simultánea en el editor quedan fuera de 1.0. El cierre automático de cuentas y el cambio de perfil dentro de una cuenta tampoco forman parte de esta versión; no se simulan como opciones disponibles.

## 2. Catálogo de requisitos

| ID | Comportamiento | Comprobación principal |
|---|---|---|
| RF-01 | Registro, confirmación de correo, acceso, recuperación y perfil docente o estudiante. | Acceso y recuperación válidos; operaciones ajenas denegadas. |
| RF-02 | Materias con curso/año, código, aprobación, retiro, archivo por 30 días y eliminación posterior. | Pertenencia separada; restauración y eliminación sin afectar otras materias. |
| RF-03 | Recursos por bloques, autosave, vista previa y publicación explícita. | Recuperar borrador, detectar conflicto y publicar solo contenido válido. |
| RF-04 | Biblioteca, quizzes independientes o integrados, copias y versiones. | Copia independiente; contenido utilizado por intentos inmutable. |
| RF-05 | Práctica/examen; avance individual o guiado; fechas, tiempo, intentos y reconexión. | Plazos de servidor, mismo intento al reconectar y cierre consistente. |
| RF-06 | Rachas, sonidos, equipos, clasificación y una pista/un doble por estudiante y actividad cuando se habiliten. | Consumo único, clasificación coherente y señales compatibles con visibilidad. |
| RF-07 | Valores por pregunta, corrección automática/manual, puntos de juego y nota máxima. | Cálculos reproducibles, escritura siempre manual y nota limitada al máximo. |
| RF-08 | Publicación individual de notas, revisión versionada y promedio ponderado sobre 100. | Solo notas propias publicadas; pendientes distintos de cero. |
| RF-09 | Controles de integridad e incidencias para revisión docente. | Señales limitadas y explicadas; ninguna sanción automática. |
| RF-10 | Tareas con archivos, plazos, corrección manual, reemplazo y reentrega autorizada. | Archivos privados y evaluaciones anteriores conservadas. |
| RF-11 | Actividades de calificación manual. | Registro y publicación de nota individual con máximo y peso. |
| RF-12 | Evolución, distribución de notas, entregas, tablas y filtros. | Tabla y gráfico equivalentes; pendientes y filtros explícitos. |
| RF-13 | Selección simple/múltiple, verdadero/falso, relaciones, secuencias, espacios y respuesta abierta. | Cada tipo crea, presenta y corrige según sus reglas. |
| RF-14 | Mezcla configurable compatible con ritmo y dependencias. | Mismo conjunto, orden persistente y explicaciones unidas a sus preguntas. |
| RF-15 | Retroalimentación configurable y transiciones continuas. | Sin confirmación intermedia de guardado ni filtración de aciertos ocultos. |
| RF-16 | Configuración principal, opciones avanzadas y resumen de reglas. | Combinaciones válidas y reglas comprensibles antes de comenzar. |
| RF-17 | Ayuda inicial y contextual por rol. | Opcional, reabrible, accesible y sin consumir intentos ni alterar datos. |
| RNF-01 | Adaptación a celular y computadora. | Recorridos completos, reflujo y controles operables en ambos. |
| RNF-02 | Usabilidad y accesibilidad evaluables. | Teclado, foco, semántica, contraste, tiempo y tareas de uso con evidencia. |
| RNF-03 | Meta de cuatro actividades de 50 estudiantes, más sus cuatro docentes. | Prueba reproducible con tiempos, errores, persistencia y consumo. |
| RNF-04 | Inicio con servicios gratuitos. | Planes, cuotas y elegibilidad comprobados; sin activar cobros. |
| RNF-05 | Integridad, privacidad y autorización. | Rechazo de accesos ajenos y protección de soluciones, archivos y credenciales. |
| RNF-06 | Desarrollo y operación reproducibles. | Migraciones, pruebas, CI, documentación y recuperación asociadas a una versión. |

Los umbrales, métodos y criterios de liberación están en el [plan de calidad](docs/calidad/plan-de-calidad.md). Ninguno se considera alcanzado hasta medirlo.

## 3. Cuentas, materias y pertenencia

**CU-01.** Registro con nombre visible, correo, contraseña y un perfil principal. Confirmar correo antes de crear materias o solicitar ingreso. Recuperación por enlace; enlaces inválidos, vencidos o usados no modifican la cuenta. El mensaje público de recuperación no revela si un correo existe. Admitir pegado y gestores de contraseñas.

**CU-02.** El docente es propietario de sus materias. Nombre, curso y año son editables; dos materias pueden tener el mismo nombre. Los identificadores y relaciones, no los nombres, separan integrantes y resultados. No hay un módulo adicional de cursos institucionales.

**CU-03.** Cada materia activa tiene un código aleatorio de ocho caracteres sin caracteres ambiguos. No caduca automáticamente; el docente puede renovarlo o desactivarlo. El código identifica la solicitud, no concede acceso al contenido. Renovarlo no elimina solicitudes existentes ni membresías.

**CU-04.** Solicitudes pendientes, aprobadas o rechazadas. No puede haber dos pendientes para la misma cuenta/materia. Repetir aprobación no crea otra membresía. Tras rechazo se permite una nueva solicitud con código vigente, conservando eventos anteriores para el docente. Acceder a materiales y actividades exige aprobación vigente.

**CU-05.** Retirar a un estudiante revoca acceso y bloquea nuevas respuestas. Sus intentos abiertos se cierran por retiro, conservan lo confirmado y quedan sin calificación publicable hasta revisión expresa del docente. Las notas y entregas existentes se conservan para el docente. Reingresar exige otra aprobación; restaura consulta y oportunidades restantes, sin reabrir intentos ni recuperar potenciadores. No altera cuentas ni otras materias.

**CU-06.** Limitar solicitudes con código a diez por cuenta en diez minutos; repetir una solicitud pendiente devuelve su estado. Los intentos adicionales se rechazan temporalmente. Los límites de autenticación y correo se ajustan al proveedor y se documentan antes de publicar.

## 4. Recursos y versiones

**RE-01.** Biblioteca con búsqueda por título, filtro por recurso/quiz y orden por modificación o título. Solo el propietario edita. Reutilizar entre materias crea una copia independiente de contenido y referencias permitidas, sin copiar estudiantes, respuestas ni notas.

**RE-02.** Bloques: título, texto con formato, listas, imágenes con texto alternativo, video mediante enlace y quiz. Un recurso puede publicarse solo para lectura, sin nota. Si contiene quiz, este tiene al menos una pregunta válida. Cada recurso evaluado contiene un quiz; varios quizzes se organizan como recursos o actividades separados. El recorrido 001 se centra en explicación y quiz.

**RE-03.** Guardar tras un segundo sin cambios y al abandonar un campo cuando corresponda. Distinguir guardando, guardado y fallo; guardado requiere confirmación del servidor. Una revisión del borrador detecta cambios desde otra pestaña. Ante conflicto, permitir conservar una copia o recargar, sin sobrescribir silenciosamente. La vista previa no publica ni crea intentos.

**RE-04.** Publicar genera una versión inmutable. Consignas visibles y soluciones reservadas se exponen por separado. Una actividad referencia versión y reglas; los intentos conservan esa referencia. Actualizar configuración e iniciar el primer intento son operaciones coordinadas: un intento nunca recibe partes de versiones diferentes.

**RE-05.** Desde el primer intento se congelan contenido, puntuación, intentos, ritmo, equipos y visibilidad. Editar el recurso prepara otra versión para una actividad nueva. Se admiten ampliaciones de plazo registradas y revisión/publicación de evaluaciones. Cambiar peso, máximo o inclusión en promedio después de comenzar requiere otra actividad; no recalcular el historial silenciosamente.

**RE-06.** Límites iniciales: título de 120 caracteres, 200 bloques por recurso, 100 preguntas por quiz y respuesta escrita de 5.000 caracteres. Imágenes JPEG, PNG o WebP, hasta 5 MiB cada una. Validar contenido y tamaño en servidor. Video mediante enlace HTTPS, sin subir video; si no puede insertarse de forma segura y accesible, mostrar un enlace descriptivo. No ejecutar HTML o scripts proporcionados como contenido.

## 5. Configuración, disponibilidad y participación

**AC-01.** Formulario principal: nombre, materia, práctica/examen, nota máxima, inclusión en promedio, modo de avance y disponibilidad. Opciones avanzadas: intentos, tiempo, corrección, peso, mezcla, retroalimentación, equipos, clasificación, potenciadores e incidencias. Mostrar opciones compatibles y resumen antes de publicar e iniciar.

| Valor inicial configurable antes del primer intento | Práctica | Examen |
|---|---|---|
| Intentos en avance individual | 3; mejor resultado completo. | 1. |
| Nota máxima / peso | 100 / 1. | 100 / 1. |
| Cuenta para promedio | No. | Sí. |
| Duración propia del intento | Desactivada. | Desactivada. |
| Retroalimentación | Después de responder. | Después del cierre y publicación de revisión. |
| Mezcla | Desactivada. | Desactivada; se recomienda activarla donde sea compatible. |
| Equipos, clasificación, rachas y potenciadores | Desactivados; el docente puede habilitarlos. | Desactivados; el docente puede habilitarlos. |
| Sonido del participante | Desactivado; activación voluntaria si la actividad lo permite. | Desactivado. |

**AC-02.** En avance individual se programa apertura y cierre; se completa sin conexión del docente. El cierre es obligatorio para una actividad evaluada; un recurso solo de lectura no lo exige. Mostrar zona horaria y pedir que el docente la confirme al configurar. Duración propia y cierre son restricciones diferentes.

**AC-03.** Un inicio válido crea un único intento abierto por estudiante/actividad y consume una oportunidad. Abrir instrucciones no consume intentos. Dos pestañas concurrentes recuperan el mismo. Uno cerrado consume una oportunidad; uno no creado por fallo no la consume. Un intento en curso no tiene nota final.

**AC-04.** Una pregunta a la vez. Seleccionar o escribir y confirmar con Responder. El envío confirmado es definitivo dentro del intento; no hay retroceso editable. Consultar explicaciones disponibles no cambia respuestas. La última respuesta cierra el intento individual. Sin retroalimentación inmediata se pasa a la siguiente pregunta; no hay pantalla de «Respuesta guardada».

**AC-05.** Un fallo mantiene la respuesta pendiente en pantalla y permite reintentar; no simula avance. Repetir un envío no duplica respuesta, puntos ni potenciadores. Reutilizar la misma clave con contenido distinto se rechaza. Reconectar recupera intento, orden, respuestas confirmadas y plazo. No se promete recuperar texto nunca enviado tras cerrar el navegador.

**AC-06.** Plazo efectivo con hora de servidor: menor entre cierre general e inicio más duración, con ampliaciones autorizadas. Avisar al quedar un minuto, o al iniciar si queda menos; no anunciar el contador cada segundo al lector de pantalla. Al vencer, cerrar intento; lo no respondido vale cero, salvo cierre administrativo pendiente de revisión. Lo escrito y recibido sigue pendiente de corrección manual.

**AC-07.** Permitir duración desactivada y ampliaciones individuales antes del cierre. Una ampliación fuera del cierre general exige ampliar también ese cierre. Registrar actor, cambio y hora. No reabrir automáticamente un intento cerrado. Evaluar accesibilidad del tiempo con las alternativas reales, no únicamente con el aviso.

**AC-08.** Modo guiado: sala de espera, comienzo y apertura/cierre de cada pregunta por el docente, con un intento por sesión. Unirse a la sala no consume intento; al comenzar se crean los intentos de estudiantes aprobados inscritos en esa sala, de forma idempotente. Las instrucciones avisan que el inicio docente consume la oportunidad aunque el estudiante se desconecte; puede reconectar. Otras rondas son nuevas actividades. Todos tienen abierta la misma pregunta; se pueden mezclar opciones. Quien confirma pasa al progreso grupal. Al cerrar la pregunta, quienes no respondieron obtienen cero en ella; el docente confirma si quedan respuestas pendientes. El servidor deja de aceptar respuestas de preguntas cerradas. Cerrar la última pregunta finaliza normalmente la sesión y sus intentos, conservando correcciones manuales pendientes; no es un cierre administrativo.

**AC-09.** Tras iniciar una sesión guiada no ingresan participantes nuevos; sí reconectan quienes tenían intento. Si el docente se desconecta no se avanza automáticamente; se conservan pregunta abierta y plazos de servidor. Reconectar recupera el control. Cerrar anticipadamente exige confirmación con recuento de pendientes y motivo; conserva respuestas, cierra intentos y registra el evento. Una desconexión por sí sola no atribuye falta al estudiante.

## 6. Preguntas, mezcla y corrección

**PR-01.** Pregunta con identificador estable, consigna, valor positivo, corrección, explicación y pista opcionales. Guía manual privada. De dos a ocho opciones en selección; de dos a doce elementos en relaciones/secuencias; de uno a diez espacios. Corregir por identificadores, no posiciones visuales mezcladas.

| Tipo | Construcción y puntuación |
|---|---|
| Selección simple | Una opción correcta; valor completo o cero. |
| Selección múltiple | Uno o más aciertos definidos; solo el conjunto exacto obtiene valor completo. Incompleto o con opciones adicionales obtiene cero. |
| Verdadero/falso | Dos alternativas y una correcta; valor completo o cero. |
| Relacionar | Correspondencias uno a uno; valor repartido por igual entre pares; puntos proporcionales a pares correctos. |
| Ordenar | Posición esperada por elemento; valor repartido por igual entre posiciones; puntos proporcionales a posiciones correctas. |
| Completar con opciones | Igual parte del valor por espacio; cada uno evalúa su opción correcta. |
| Completar escribiendo | Revisión manual por espacio y partes iguales del valor. No corregir por coincidencia de texto. |
| Respuesta abierta | Nota manual entre cero y máximo, con guía y comentario opcional. |

**PR-02.** Preguntas cerradas pueden pasar a revisión manual por configuración del quiz; escritura siempre manual. No descontar puntos por error en 1.0. Pendiente no equivale a cero. Rechazar calificaciones manuales fuera del intervalo permitido.

**PR-03.** Las explicaciones asociadas viajan con sus preguntas. En individual, el docente puede agrupar preguntas dependientes en una secuencia fija; la mezcla permuta grupos y preguntas independientes, conservando orden interno. El resumen indica qué no cambia de orden. Mezclar opciones solo donde corresponda; no permutar texto fijo de frases ni etiquetas verdadero/falso.

**PR-04.** Persistir orden por intento. Reconectar no sortea otra vez. Mismo conjunto para todos; no se garantiza orden exclusivo por estudiante. En guiado no se mezcla el orden de preguntas por participante.

## 7. Puntos, notas y publicación

**EV-01.** B = suma de puntos base obtenidos; Q = suma de máximos; D = adicional ganado por doble; M = máximo de actividad. Q y M son positivos. Juego: B + D. Sin bonificación en nota: `M × B / Q`. Con bonificación: `mínimo(M, M × (B + D) / Q)`.

**EV-02.** Usar decimales o razones exactas y redondear solo la nota final a dos decimales, mitad hacia arriba. La nota publicada, su máximo y peso entran al promedio. Una evaluación parcial no tiene nota final.

**EV-03.** Ejemplo: máximos 2, 3 y 5; puntos base 2, 0 y 4; máximo de actividad 20. Nota 12,00. Doble en la primera respuesta correcta: D = 2; juego 8 y nota 16,00 solo si la bonificación cuenta. Una respuesta manual pendiente impide publicar ese intento como resultado completo.

**EV-04.** Elegir el mejor intento cerrado y completamente corregido por nota, sin premiar rapidez. Empates de nota conservan el primero completado. Indicar otros intentos pendientes; la mejor nota completa puede publicarse. Otra corrección no cambia la nota publicada sin nueva publicación explícita.

**EV-05.** Cada estudiante ve solo sus notas publicadas. Publicación individual sin esperar al grupo. Corrección posterior genera revisión con motivo; conserva nota anterior hasta republicar y registra valores, actor y fecha. En quiz, el total deriva de corregir preguntas; no se reemplaza arbitrariamente. En tarea/actividad manual se modifica directamente la nota dentro del máximo, con historial.

**EV-06.** Promedio: `100 × suma((nota publicada / máximo) × peso) / suma(pesos incluidos)`. Incluir solo notas publicadas marcadas para contar, con peso positivo. Redondeo final a dos decimales. 12/20 con peso 2 y 90/100 con peso 1 dan 70,00. Cero publicado sí cuenta. Sin resultados: «Sin calificaciones publicadas».

**EV-07.** No entregada, no evaluada o quiz nunca iniciado no generan cero automático. El docente puede registrar cero con motivo de no participación y publicarlo, distinguiéndolo de un intento respondido. Un intento iniciado y vencido aplica AC-06.

**EV-08.** Promedio habitual de una materia y su año. Un filtro de fechas produce promedio del intervalo, identificado, por fecha de cierre/realización de actividad y mismos pesos. No hay periodos trimestrales configurables ni promedio global entre materias en 1.0.

## 8. Retroalimentación, juego y equipos

**JU-01.** Políticas: inmediata; después de cierre y publicación de revisión; ocultar siempre. Separar nota publicada de revisión de respuestas. Publicar nota agregada no abre soluciones fuera de sus condiciones. Acompañar color con texto/icono. Escritura no recibe acierto automático.

**JU-02.** Antes de liberar revisión, no exponer soluciones, explicaciones reservadas, puntos por pregunta, rachas ni clasificación a estudiantes. Progreso depende solo de preguntas respondidas. En diferida, señales de juego después de cierre y publicación de todas las evaluaciones necesarias para la clasificación. En ocultar siempre, rachas y clasificación estudiantiles se deshabilitan y se explica en configuración. El docente conserva acceso. La nota agregada publicada es excepción explícita, sin desglose oculto.

**JU-03.** Racha = preguntas consecutivas con valor base completo, sin puntos adicionales por velocidad o racha. Error o corrección manual interrumpen la racha visible; no reconstruir animaciones pasadas al corregir. Mostrar solo si JU-02 permite. Sonidos desactivables, sin información exclusivamente auditiva; movimiento respeta reducción.

**JU-04.** Docente habilita pista, doble o ambos. Un uso de cada uno por estudiante para toda la actividad, compartido entre intentos. Pista preparada para la pregunta; si no existe, no consumir. Consumir al registrar y autorizar revelación; reintentar recupera la misma sin otro cargo. No resta puntos.

**JU-05.** Doble elegido antes de confirmar y consumido al aceptar el envío. Error válido consume uso y suma cero; envío rechazado no consume. D equivale a puntos base obtenidos en esa pregunta, incluso parciales o corregidos manualmente. Consumo y respuesta atómicos. No hay otros potenciadores en 1.0.

**JU-06.** Clasificación individual por puntos de juego del mejor intento cerrado y completamente corregido por puntos. Empates comparten puesto (1, 1, 3), sin premiar rapidez. Durante actividad, si se permite mostrarla, usar el mayor total conocido entre intentos abiertos/cerrados, identificado como provisional y con pendientes indicados. No es una nota. Definitiva solo tras cierre y corrección completa de los intentos considerados.

**JU-07.** Reparto automático equilibrado entre equipos, diferencia máxima de tamaño de uno; ajustes docentes antes de iniciar. Congelar lista al comenzar. Respuestas y notas individuales. Equipo = promedio de puntos del juego de su lista congelada; integrante sin intento aporta cero a clasificación, sin crear nota cero. No aceptar equipos vacíos. Empates comparten puesto.

**JU-08.** Clasificación visible solo para participantes aprobados cuando se habilita; no hay enlace público anónimo. Estudiantes ven alias estables de actividad (Participante 01), equipo y puntuación permitida; docente identifica cuentas. No mostrar correos ni apellidos. Retirado conserva contribución según su último resultado y su caso se resuelve antes de dar clasificación definitiva.

## 9. Tareas, actividades manuales y seguimiento

**TA-01.** Tarea con título, consigna, materia, apertura/cierre, máximo, peso, inclusión y permiso de tardías. PDF, DOCX, JPEG, PNG o WebP; hasta cinco archivos, 10 MiB por archivo y 20 MiB por versión. Versiones anteriores cuentan para cuotas. Validar contenido, extensión y tamaño; rechazar ejecutables, macros y rutas manipuladas. No ejecutar lo subido.

**TA-02.** Archivos privados para propietario docente y estudiante autor con pertenencia vigente. Reemplazar una entrega sin calificar antes del cierre crea versión y conserva anterior. Subida incompleta no es entrega recibida. Después del plazo, aceptar solo con tardías habilitadas y marcarlo.

**TA-03.** Tras calificar, reentrega individual habilitada con fecha límite explícita, que puede ampliar el plazo original. Nueva entrega pendiente conserva archivos/evaluación anteriores; nota publicada permanece hasta republicar. Un fallo no elimina entrega válida. Máximo, peso e inclusión fijos desde primera entrega o evaluación.

**TA-04.** Actividad manual: título, materia, fecha, descripción opcional, máximo, peso e inclusión. Nota/comentario individual, publicación y revisión con motivo. Ausencia de registro es pendiente; no inventar archivo o intento. Congelar máximo/peso/inclusión al registrar primera evaluación.

**SE-01.** Evolución: actividades por fecha de cierre/realización y nota publicada normalizada sobre 100. Distribución por actividad: [0,20), [20,40), [40,60), [60,80), [80,100], incluyendo 100. Pendientes y sin participación separados, nunca ceros implícitos.

**SE-02.** Recuentos de completadas, en curso y no iniciadas/no entregadas; corrección pendiente como dimensión separada para no duplicar totales. Filtros por materia, curso, año y fechas. Resumen entre materias conserva grupos separados, sin promedio global. Tablas equivalentes a gráficos.

**SE-03.** Reporte docente distingue corregidas sin publicar y publicadas. Gráficos de notas usan publicadas; bandeja de corrección muestra pendientes. Estudiante consulta evolución propia, nunca distribución nominal de compañeros.

## 10. Integridad y conservación

**IN-01.** Validar pertenencia, plazo, versión, intento, orden y consumo en servidor. Mezcla y soluciones reservadas complementan controles. No confiar en notas o roles del cliente.

**IN-02.** Registro de ocultamiento de pestaña opcional, habilitado por docente y avisado antes del intento. Conservar solo intento, inicio/fin o duración aproximada y hora de recepción, con frecuencia limitada. Es señal del navegador, no prueba de trampa; no revela otra aplicación o dispositivo. No capturar pantalla, teclado global, cámara o audio. Sin pantalla completa impuesta en 1.0.

**IN-03.** Incidencia pendiente, revisada sin acción o con observación. Comentario docente, sin sanción ni nota automática. Cambiar evaluación sigue EV-05. Separar conexión/rechazos técnicos de señales de visibilidad. Mostrar límites de interpretación.

**IN-04.** Archivar exige confirmar consecuencias. Materia de solo lectura para docente, sin acceso estudiantil, nuevos intentos o entregas. Intentos abiertos se cierran por archivo y requieren revisión, sin publicar ceros administrativos. Restaurar dentro de 30 días devuelve acceso, sin reabrir intentos ni extender fechas; revisar disponibilidades.

**IN-05.** A los 30 días exactos se revoca restauración y comienza eliminación de materia, membresías, actividades, intentos, notas, entregas y archivos exclusivos. Conservar biblioteca independiente, otras materias y cuentas. Eliminar archivos solo sin otras referencias autorizadas. Ejecución idempotente con reintentos/errores registrados; objetivo de borrado activo completo en 24 horas desde vencimiento.

**IN-06.** La purga comprueba estado/plazo antes de cada lote y no compite con restauración válida. Borrado activo no promete borrado inmediato de respaldos. Documentar exportación, recuperación y retención técnica disponible antes de producción. Señales de visibilidad se eliminan 30 días después del cierre; conservar solo resolución mínima docente, si existe, mientras exista materia. No incluir textos de respuestas en registros técnicos de errores.

**IN-07.** Un intento cerrado por retiro, archivo o cierre anticipado del docente requiere resolución con motivo: evaluar lo confirmado y asignar cero a las preguntas omitidas, o excluir ese intento de selección de nota y clasificación. En ambos casos conservar respuestas y causa; excluir no crea una nota cero ni devuelve oportunidades o potenciadores. Un estudiante sin otro intento evaluable queda sin resultado; en equipos mantiene la contribución cero definida para ausencia de resultado. La revisión de una materia archivada exige restaurarla, pues el archivo es de solo lectura. No dar clasificación definitiva mientras existan cierres administrativos sin resolver.

## 11. Ayuda inicial por rol

**AY-01.** Primera entrada tras confirmar correo: ofrecer «Conocer Aulify» y «Ahora no». Hasta cinco pasos breves por recorrido, con cierre, retroceso y repetición desde Ayuda. Persistir ofrecida, omitida o completada por cuenta/rol/versión; no interrumpir cada acceso. Nueva versión ofrece invitación discreta, sin abrirse automáticamente.

**AY-02.** Docente: crear materia, invitar/aprobar, preparar recurso, previsualizar/publicar y revisar. Estudiante: ingresar código, reconocer espera, abrir actividad, responder y consultar resultado. Si una pantalla o permiso no existe aún, explicar el próximo paso sin apuntar a elementos ausentes. Dividir guías por momento de uso.

**AY-03.** Avanzar en guía no crea materias, publica, envía respuestas ni consume intentos. Demostraciones con datos ficticios identificados. No abrir guía superpuesta durante intento; ayuda estática sin pausar plazos. Teclado, foco restaurado al cerrar, lectura comprensible, movimiento reducido y móvil sin tapar el control explicado.

**AY-04.** Estados vacíos con siguiente acción útil; explicar intento, peso y publicación. Ayuda permanente sin exigir completar tutorial. Omitir o cerrar no limita funciones.

## 12. Estados y permisos para modelar

| Objeto | Estados o dimensiones |
|---|---|
| Materia | Activa, archivada, en eliminación, eliminada. |
| Pertenencia | Solicitud pendiente/rechazada; membresía aprobada/retirada. |
| Recurso | Borrador mutable y versiones publicadas inmutables. |
| Actividad | Borrador, programada, abierta, cerrada; guiada añade espera y pregunta abierta/cerrada. |
| Intento | En curso; cerrado por envío, finalización guiada, vencimiento, retiro, archivo o cierre docente anticipado. |
| Corrección | Pendiente/completa; cierre administrativo requiere resolución para evaluar o excluir el intento. |
| Evaluación | Sin publicación o versión publicada, con posible revisión privada coexistente. |
| Entrega | Versión recibida, evaluación asociada y autorización de reentrega. |
| Ayuda | Sin ofrecer, ofrecida, omitida o completada por versión/rol. |

Docente administra su materia. Estudiante aprobado accede a materiales autorizados y a sus intentos, archivos y notas. Pendientes, retirados y ajenos no acceden a datos privados. Vista previa docente no genera participación. Mantener permisos ante operaciones directas y manipulación de identificadores, no solo mediante controles visuales.

## 13. Límites y siguiente trabajo

Esta versión cierra reglas funcionales del alcance descrito. Los valores iniciales pueden revisarse mediante cambios documentados; no se atribuye validación con usuarios todavía.

Sigue el modelo conceptual/relacional/físico, contratos, migraciones, diseño y selección técnica comprobada. SMTP, transporte guiado, eliminación programada, respaldo, bibliotecas y elegibilidad del alojamiento requieren decisiones de implementación y evidencia. No resolver activando cobros o reduciendo alcance implícitamente.

Trazabilidad y construcción: [tareas](tasks.md), [aceptación](specs/aceptacion-producto.md) y [calidad](docs/calidad/plan-de-calidad.md). Una función se completa solo al comprobarla y documentar resultados reales.
