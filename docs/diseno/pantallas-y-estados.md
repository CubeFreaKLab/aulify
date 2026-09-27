# Pantallas y estados del prototipo

Inventario de la interfaz web construida. La especificación del producto sigue en [specification.md](../../specification.md); este documento describe lo que puede explorarse en el prototipo y sus límites. La presencia de una pantalla no acredita los 76 casos de aceptación ni la integración con los servicios de producción.

## Cómo interpretar el alcance

- **Operativo en la demostración:** la interacción ejecuta código y, cuando corresponde, actualiza el repositorio local de datos ficticios. Puede comprobarse en el navegador.
- **Representación limitada:** permite explorar una decisión visual o una parte del recorrido, pero no reproduce el servicio completo.
- **Servicio pendiente:** necesita autenticación, servidor, correo, almacenamiento remoto u operación programada. No se presenta como una acción realizada.

El selector de perfiles cambia entre cuentas ficticias de la misma muestra. No inicia sesión. Las reglas del dominio controlan las operaciones de la demostración, pero los datos del navegador y sus roles son modificables por su propietario; no constituyen una frontera de seguridad.

## Portada y acceso

| Ruta | Propósito e interacción principal | Estados visibles | Alcance |
|---|---|---|---|
| `/` | Presentar Aulify; explorar una pregunta; entrar a los recorridos docente y estudiante. | Escena ilustrada, pregunta sin responder, elección, explicación, pregunta siguiente y ejemplo terminado; el ejemplo puede reiniciarse. | Portada y ejemplo operativos. El resumen del editor es una representación visual, no el editor completo. |
| `/acceso` | Introducir correo y contraseña de ejemplo; mostrar u ocultar contraseña; ir a recuperación o registro; explorar por rol. | Campos vacíos, errores identificados y aviso de acceso todavía no habilitado. | Validación operativa; autenticación pendiente. No almacena la contraseña ni informa un inicio de sesión exitoso. |
| `/registro` | Introducir nombre, correo y contraseña; elegir docente o estudiante; revisar el formulario. | Errores por campo, selección de perfil y enlace al recorrido elegido. | Formulario operativo; creación de cuenta y confirmación por correo pendientes. No se crea una cuenta local simulada. |
| `/recuperar` | Comprobar el formato del correo y volver al acceso. | Correo inválido; aviso de envío no habilitado. | Validación operativa; no se afirma que se envió un enlace. SMTP y recuperación real pendientes. |
| Ruta pública inexistente | Recuperarse de una dirección no válida. | Página no encontrada y enlace al inicio. | Navegación operativa. |

La portada utiliza una composición promocional distinta de la plataforma. Los textos y controles se construyen con HTML; los conceptos raster no sustituyen formularios ni pantallas funcionales.

## Espacio docente

| Ruta | Acciones disponibles | Estados que deben conservarse | Alcance |
|---|---|---|---|
| `/demo?perfil=docente` o `/demo` | Abrir materias, preparar el recurso de ejemplo, consultar pendientes y cambiar el perfil ficticio. | Preparación de la muestra, guía inicial, panel con datos y fallo al restaurar datos locales. | Operativo en la demostración. |
| `/demo/materias` | Crear una materia con nombre, curso y año; abrir una materia. | Formulario, validación, lista actualizada. | Creación local operativa; cuenta y permisos de servidor pendientes. |
| `/demo/materia/{id}` | Ver recursos; aprobar o rechazar solicitudes desde Integrantes; consultar curso, año y código. | Solicitud pendiente, aprobada o rechazada; materia no disponible. | Pertenencia local operativa. Configuración muestra detalles; archivo, restauración y eliminación programada pendientes. |
| `/demo/biblioteca` | Buscar por título, filtrar recurso o quiz, crear, editar, duplicar y previsualizar. | Resultados de búsqueda, lista vacía, borrador y recurso con versión publicada. | Operativo con copias independientes locales. |
| `/demo/editor/{recursoId}` | Editar bloques y preguntas, ordenar con controles, guardar borrador, previsualizar y publicar en una materia. | Guardando, guardado, fallo, conflicto de revisión; reintentar, conservar copia o recargar. | Edición y versiones locales operativas. No hay confirmación de un servidor remoto. |
| Diálogo Publicar del editor | Elegir materia, práctica o examen, nota máxima, cierre y participación en el promedio; desplegar opciones avanzadas. | Configuración válida o rechazada; resumen antes de publicar. | Operativo para las opciones expuestas. Las reglas del producto que todavía no tienen control o servicio no se consideran implementadas. |
| `/demo/previa/{recursoId}` | Leer el borrador y probar los controles de sus preguntas; volver al editor. | Recurso disponible o no disponible; opciones de prueba. | Previsualización operativa: no publica, no registra respuestas y no consume intentos. |
| `/demo/actividad/{actividadId}` | Consultar la versión publicada; en ritmo guiado, abrir la sesión, cerrar una pregunta y abrir la siguiente. | Espera, sesión en marcha, pregunta abierta/cerrada y sesión finalizada. | Máquina de estados local operativa. No sincroniza dispositivos remotos. |
| `/demo/revision` | Seleccionar un intento cerrado; leer respuestas y puntuaciones; corregir escritura; revisar una corrección con motivo; publicar la nota individual. | Por corregir, corregido sin publicar y publicado; publicación deshabilitada sin un intento completo elegible. | Operativo. La publicación toma el mejor intento completo según las reglas del dominio y conserva las revisiones utilizadas. |
| `/demo/resultados` | Filtrar por materia, curso y año; consultar resultados y promedios con gráfico y tabla equivalente. | Sin participación, en curso, por revisar, sin publicar y publicado; filtros sin resultados. | Operativo con notas locales. Cada materia y estudiante conserva su propio promedio; lo pendiente no se convierte en cero. |
| `/demo/tareas` | Crear consignas y plazos; consultar entregas; guardar corrección manual y publicar la nota. | Sin entregas, por revisar, corregida sin publicar y publicada. | Creación, metadatos y calificación operativos. La revisión no abre archivos porque sus bytes no se conservan en esta entrega. |

## Espacio estudiante

| Ruta | Acciones disponibles | Estados que deben conservarse | Alcance |
|---|---|---|---|
| `/demo?perfil=estudiante` | Consultar las materias aprobadas y abrir la actividad de ejemplo. | Guía inicial, materias y actividades disponibles. | Operativo con perfil ficticio. |
| `/demo/materias` | Solicitar ingreso mediante código y abrir materias aprobadas. | Código rechazado, solicitud pendiente y materia aprobada. | Operativo en el repositorio local; el código no concede acceso por sí solo. |
| `/demo/materia/{id}` | Abrir recursos de una materia aprobada. | Contenido disponible o solicitud de aprobación. | Operativo en la demostración. |
| `/demo/actividad/{actividadId}` | Leer el recurso, consultar reglas, iniciar o retomar el intento, responder y utilizar los potenciadores habilitados. | Lectura, pregunta activa, respuesta inválida, retroalimentación permitida, espera guiada, vencimiento y finalización. | Intentos y corrección local operativos. Tiempo confiable, autorización y persistencia del servidor pendientes. |
| `/demo/resultados` | Consultar estados y notas propias publicadas; filtrar materias, curso y año; leer comentarios permitidos. | Pendiente de revisión, sin publicar o publicado; promedio sin notas todavía. | Usa la proyección de resultados del estudiante. No muestra puntuaciones privadas como calificaciones publicadas. |
| `/demo/tareas` | Leer la consigna, seleccionar archivos de ejemplo, registrar metadatos y comentario, reemplazar una entrega todavía no corregida. | Archivos rechazados por límites, entrega registrada, entrega tardía permitida, corregida sin publicar y nota publicada. | No sube ni almacena el contenido de los archivos. Una reentrega posterior a la corrección requiere un flujo de autorización aún pendiente. |

La participación admite selección simple, selección múltiple, verdadero/falso, relaciones, secuencias, espacios con opciones, espacios escritos y respuesta abierta. Las respuestas escritas quedan para revisión docente. Sin retroalimentación inmediata, responder avanza sin una pantalla intermedia de “respuesta guardada”. Los aciertos no se anuncian cuando la configuración los mantiene ocultos.

## Ayuda, preferencias y estados compartidos

| Ruta o estado | Interacción y límite |
|---|---|
| `/demo/ayuda` | Guía breve por rol y acción para volver a ofrecerla. Omitir la guía no bloquea funciones ni consume intentos. |
| `/demo/preferencias` | Consulta del perfil ficticio y del comportamiento de movimiento reducido; reinicio de la muestra con confirmación. No contiene configuración de cuenta real. |
| Guía del inicio | “Ahora no” omite; “Empezar a explorar” continúa al destino del rol. La preferencia se conserva localmente. |
| Cambio de perfil | Permite explorar los datos ficticios del docente y de distintos estudiantes; conserva el estado de la misma muestra. |
| Carga | Esqueletos mientras se prepara el estado o el editor. No se añade espera artificial para exhibirlos. |
| Error de operación | Aviso con el mensaje del dominio y opción de cerrar. La operación fallida no se anuncia como realizada. |
| Datos locales no restaurables | Explicación y opción de reiniciar los datos de la demostración. |
| Destino interno desconocido o no permitido | Estado vacío con orientación para volver a los destinos disponibles. Ocultar una ruta no sustituye autorización de servidor. |

## Servicios y comportamientos que siguen pendientes

| Área | Pendiente fuera de la demostración |
|---|---|
| Cuentas | Supabase Auth, confirmación de correo, recuperación por enlace, sesiones reales y comprobaciones de identidad. |
| Correo | Proveedor SMTP y verificación de entrega, errores, enlaces usados o vencidos y límites de envío. |
| Datos y permisos | Migraciones aplicadas, PostgreSQL, RLS y operaciones de servidor que impidan leer soluciones, notas o archivos ajenos. |
| Archivos | Almacenamiento privado de bytes, validación del contenido, descargas autorizadas, sustitución y conservación de versiones. |
| Sesiones y tiempo | Sincronización entre dispositivos, hora de servidor, reconexión de red y pruebas de carga de la meta del producto. |
| Conservación | Archivo por 30 días, restauración y eliminación programada con comprobación de fallos parciales. |
| Alcance complementario | Equipos, clasificación completa, sonidos, reportes de integridad, actividades manuales independientes y autorización de reentregas necesitan sus recorridos y comprobaciones. Tener tipos o propiedades de configuración no equivale a ofrecerlos en la interfaz. |

## Criterios para registrar una verificación

Conservar la versión del código, ruta, perfil ficticio, tamaño de pantalla, pasos y resultado observado. Distinguir comprobaciones de escritorio, móvil, teclado y movimiento reducido. Los resultados automáticos de accesibilidad no sustituyen la inspección manual ni una evaluación de usabilidad con participantes.

Una captura puede mostrar la composición de una pantalla. Para afirmar que guardar, corregir o publicar funciona, la evidencia debe comprobar también el cambio de estado y su posterior lectura. Las capturas de conceptos visuales y las de la aplicación ejecutada se identifican por separado.

Fuentes de este inventario: [enrutamiento del espacio de trabajo](../../src/components/workspace.tsx), [acceso](../../src/components/auth-screen.tsx), [editor](../../src/components/editor-screen.tsx), [participación](../../src/components/activity-screen.tsx), [revisión, resultados y tareas](../../src/components/results-screen.tsx), [repositorio local](../../src/domain/repository.ts) y [operaciones del dominio](../../src/domain/operations.ts).
