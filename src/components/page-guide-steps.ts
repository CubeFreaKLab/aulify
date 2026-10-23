export type GuideStep = { target: string; title: string; body: string };
const step = (target: string, title: string, body: string): GuideStep => ({ target, title, body });
export function pageGuideSteps(page: string, teacher: boolean): GuideStep[] {
  switch (page) {
    case 'inicio':
      return [
        step(
          '.page-heading',
          teacher ? 'Tu espacio docente' : 'Tu espacio de estudiante',
          teacher
            ? 'Desde aquí preparas tus clases y revisas lo que necesita atención. Vamos a ubicar las herramientas principales.'
            : 'Aquí encuentras tus materias, actividades y entregas. Esta guía te muestra dónde empezar.',
        ),
        step(
          '.page-heading .button',
          'Empieza un recurso',
          'Crear recurso abre un borrador. Escribe primero: todavía no lo ve tu clase.',
        ),
        step(
          '.welcome-panel .button',
          teacher ? 'Continúa tu clase' : 'Explora una actividad',
          teacher
            ? 'Este acceso retoma un recurso de tu biblioteca. Podrás editar, previsualizar y elegir después dónde publicarlo.'
            : 'Abre las instrucciones y revisa plazo e intentos. Consultarlas no inicia el intento; Empezar sí.',
        ),
        step(
          '.metric-row',
          'Lee el resumen',
          teacher
            ? 'Estos contadores muestran materias, actividades e intentos por revisar. Una respuesta pendiente necesita tu atención.'
            : 'Distingue lo disponible de lo pendiente. Una nota pendiente no significa que tengas un cero.',
        ),
        step(
          '.subject-card',
          'Entra en tu materia',
          teacher
            ? 'Cada materia reúne sus recursos, integrantes y configuración. Puedes trabajar con varios cursos por separado.'
            : 'Abre la materia para encontrar lo que compartió tu docente y entrar a cada actividad.',
        ),
        step(
          '.app-topbar',
          'Vuelve cuando lo necesites',
          'El botón «Guía de esta página» permite repetir el recorrido. Puedes cerrarlo en cualquier paso; todas las funciones siguen disponibles.',
        ),
      ];
    case 'materias':
      return [
        step(
          '.page-heading',
          'Tus grupos, en un lugar',
          teacher
            ? 'Cada tarjeta representa una materia y un curso. Los estudiantes y resultados se mantienen separados.'
            : 'Aquí aparecen las materias en las que tu docente ya aprobó tu ingreso.',
        ),
        step(
          '.page-heading .button',
          teacher ? 'Crea una materia' : 'Solicita ingresar',
          teacher
            ? 'Pulsa Crear materia y escribe nombre, curso o grupo y año. Después podrás completar sus detalles.'
            : 'Pulsa Unirme a una materia e introduce el código que te dio el docente. El código solicita acceso; debes esperar su aprobación.',
        ),
        step(
          '.subjects-grid',
          'Abre una materia',
          teacher
            ? 'Elige una tarjeta para compartir recursos, invitar integrantes y revisar su configuración.'
            : 'Elige una tarjeta para consultar materiales y actividades. Si tu solicitud está pendiente, todavía no verás sus recursos.',
        ),
      ];
    case 'materia':
      return [
        step(
          '.page-heading',
          'Estás dentro de una materia',
          'Comprueba el nombre, curso y año antes de continuar. Todo lo que ves pertenece a este grupo.',
        ),
        step(
          '.page-heading .button',
          'Comparte desde tu biblioteca',
          'Elige un recurso, revisa su vista previa y publícalo en esta materia con las reglas que necesites.',
        ),
        step(
          '#subject-tab-recursos',
          'Recursos de la clase',
          teacher
            ? 'Aquí revisas los materiales compartidos y abres cada actividad para acompañar a tu clase.'
            : 'En Recursos encuentras lecturas y actividades. Una lectura no genera nota; una actividad muestra sus reglas antes de empezar.',
        ),
        step(
          '#subject-tab-integrantes',
          'Invita y aprueba estudiantes',
          'Abre Integrantes para consultar el código y revisar solicitudes. Compartir el código no aprueba el ingreso automáticamente.',
        ),
        step(
          '#subject-tab-configuración',
          'Ajusta tu materia',
          'Aquí editas los datos del curso y gestionas su archivo. Archivar no es lo mismo que eliminar.',
        ),
        step(
          '.subject-panel .list-item',
          'Abre el recurso',
          teacher
            ? 'Ver actividad permite consultar su contenido y seguimiento. Las respuestas pertenecen a la versión publicada.'
            : 'Lee las instrucciones antes de empezar. En modo guiado, espera el avance del docente después de responder.',
        ),
      ];
    case 'biblioteca':
      return [
        step(
          '[data-guide="create-resource"]',
          'Crea un borrador',
          'Prepara explicaciones, imágenes y preguntas en un mismo recurso. Guardar no lo publica.',
        ),
        step(
          '[data-guide="create-quiz"]',
          'Empieza un quiz',
          'Crear quiz abre directamente las preguntas. Elige el tipo, escribe la consigna y configura las respuestas antes de publicar.',
        ),
        step(
          '.library-search',
          'Encuentra tu material',
          'Escribe parte del título para filtrar los recursos de tu biblioteca.',
        ),
        step(
          '.library-select',
          'Filtra y ordena',
          'Puedes distinguir tipos de recurso y ordenar por cambios recientes para retomar tu trabajo.',
        ),
        step(
          '.library-sample',
          'Reconoce el contenido',
          'La muestra permite identificar el material antes de abrirlo.',
        ),
        step(
          '.library-actions',
          'Edita, revisa o duplica',
          'Editar abre el borrador. Vista previa muestra el resultado sin consumir intentos. Duplicar crea una copia independiente.',
        ),
      ];
    case 'editor':
      return [
        step(
          '#resource-title',
          'Ponle un título claro',
          'Este será el nombre que reconocerá tu clase. Puedes cambiarlo mientras trabajas en el borrador.',
        ),
        step(
          '.bn-editor .bn-block:first-child',
          'Escribe como en un documento',
          'Haz clic en un bloque y escribe. Enter crea otro bloque; al seleccionar texto puedes darle formato.',
        ),
        step(
          '.editor-quick-insert',
          'Añade un bloque',
          'Usa Imagen o Tabla. También puedes escribir / y pegar una captura con Ctrl+V; añade su descripción antes de insertarla.',
        ),
        step(
          '.editor-outline',
          'Reordena sin arrastrar',
          'Abre esta sección para mover los bloques con botones. También puedes usar el tirador al lado de cada bloque.',
        ),
        step(
          '.editor-questions-panel > summary',
          'Prepara las preguntas',
          'Despliega esta sección debajo del documento. Añade preguntas, alternativas y puntuación; las respuestas escritas requieren tu revisión.',
        ),
        step(
          '[data-guide="preview"]',
          'Mira cómo quedará',
          'Vista previa guarda el borrador y permite comprobar el contenido. No inicia una actividad ni consume intentos.',
        ),
        step(
          '[data-guide="publish"]',
          'Revisa antes de publicar',
          'Publicar abre la configuración: elige materia, propósito y reglas. Solo se comparte después de tu confirmación final.',
        ),
        step(
          '.editor-save-state',
          'Comprueba el guardado',
          'Espera a ver Borrador guardado. Si hay un conflicto, conserva una copia o reintenta antes de salir.',
        ),
      ];
    case 'previa':
      return [
        step(
          '.reader-toolbar',
          'Estás en vista previa',
          'Revisa el recurso como lo leerá tu clase. Esta vista no consume intentos ni registra respuestas.',
        ),
        step(
          '.rich-reader',
          'Comprueba tu material',
          'Revisa títulos, imágenes, enlaces y el orden de los bloques, también en una pantalla pequeña.',
        ),
        step(
          '.preview-questions',
          'Revisa las preguntas',
          'Comprueba la redacción y las opciones. Vuelve al editor para corregirlas antes de publicar.',
        ),
        step(
          '.editor-back',
          'Continúa editando',
          'Regresa al borrador cuando quieras. Publicar sigue siendo una acción separada.',
        ),
      ];
    case 'revision':
      return [
        step(
          '.page-heading',
          'Respuestas que necesitan revisión',
          'Revisa las respuestas abiertas y las que tengan corrección manual antes de publicar notas.',
        ),
        step(
          '.review-list',
          'Elige una entrega',
          'Selecciona una respuesta pendiente. Puedes recorrerlas sin mezclar los intentos de distintos estudiantes.',
        ),
        step(
          '.review-answer',
          'Lee la respuesta completa',
          'Compara la respuesta con la consigna y, cuando exista, con la guía privada de corrección.',
        ),
        step(
          '.results-review-form',
          'Asigna puntos y comenta',
          'Respeta el máximo de la pregunta. El comentario debe explicar qué estuvo bien y qué puede mejorar.',
        ),
        step(
          '.results-publish-form',
          'Publica la nota cuando esté lista',
          'Guardar una corrección y publicar una nota son pasos distintos. El estudiante solo ve lo que hayas publicado.',
        ),
      ];
    case 'resultados':
      return [
        step(
          '.page-heading',
          teacher ? 'Resultados de tus clases' : 'Tus resultados publicados',
          teacher
            ? 'Consulta el progreso por materia y actividad. Las notas pendientes se distinguen de cero.'
            : 'Aquí puedes ver las notas que tu docente publicó. Una evaluación pendiente todavía no tiene resultado.',
        ),
        step(
          '.results-filters',
          'Elige qué consultar',
          'Filtra por materia, curso o año para ver los resultados que buscas.',
        ),
        step(
          '.results-overview',
          'Interpreta el resumen',
          'El promedio usa notas publicadas y sus pesos. Lo que todavía está pendiente no se cuenta como cero.',
        ),
        step(
          '.table-wrap',
          'Consulta el detalle',
          teacher
            ? 'La tabla acompaña al gráfico y permite revisar los mismos valores sin depender del color.'
            : 'Revisa tu nota y la retroalimentación de cada actividad. No se muestran resultados privados de otras personas.',
        ),
      ];
    case 'tareas':
      return [
        step(
          '.page-heading',
          teacher ? 'Organiza las entregas' : 'Tus tareas',
          teacher
            ? 'Crea consignas, fija plazos y revisa los archivos entregados por tu clase.'
            : 'Lee la consigna y el plazo antes de adjuntar tu trabajo.',
        ),
        step(
          '.results-new-task',
          'Prepara una consigna',
          'Elige la materia y explica qué se debe entregar. Revisa la fecha y el valor antes de crearla.',
        ),
        step(
          '.task-detail',
          teacher ? 'Revisa una tarea' : 'Abre una tarea',
          teacher
            ? 'Consulta la consigna y las entregas para evaluar con los mismos criterios.'
            : 'Aquí están la consigna, los archivos y la fecha de entrega.',
        ),
        step(
          '.task-deadlines',
          'Comprueba los plazos',
          'La fecha de entrega y el límite de reentrega pueden ser diferentes. No esperes al último momento para subir el archivo.',
        ),
        step(
          '.task-student-content',
          'Adjunta y confirma',
          'Selecciona tu archivo y confirma la entrega. Comprueba el estado enviado; elegir un archivo por sí solo no termina el envío.',
        ),
        step(
          '.task-review-card',
          'Corrige y devuelve',
          'Lee el archivo, asigna la nota y escribe una devolución. Publica cuando la revisión esté completa.',
        ),
      ];
    case 'preferencias':
      return [
        step(
          '.page-heading',
          'Tu perfil y tu forma de usar Aulify',
          'Personaliza la apariencia y consulta las opciones de accesibilidad.',
        ),
        step(
          '[aria-label="Elegir avatar"], .avatar-picker',
          'Elige tu personaje',
          'Selecciona un avatar. En la demostración se conserva por perfil en este navegador.',
        ),
        step(
          '.theme-switcher, [aria-label*="modo"]',
          'Elige claro u oscuro',
          'Cambia el tema cuando lo necesites. La navegación y los controles siguen en el mismo lugar.',
        ),
        step(
          'main .surface',
          'Ajusta tus preferencias',
          'Aulify respeta el movimiento reducido del dispositivo. Puedes usar teclado y alternativas a arrastrar.',
        ),
      ];
    case 'ayuda':
      return [
        step(
          '.page-heading',
          'Ayuda a mano',
          teacher
            ? 'Aquí puedes repasar cómo preparar, compartir y evaluar tus clases.'
            : 'Aquí puedes repasar cómo entrar a tu materia, responder y consultar tus notas.',
        ),
        step(
          '[data-guide="repeat"]',
          'Repite el recorrido',
          'Cada pantalla tiene su propia guía. Usa «Guía de esta página» para volver a señalar sus controles.',
        ),
        step(
          '.help-step',
          'Consulta los pasos por escrito',
          'También tienes instrucciones que puedes leer a tu ritmo, sin animaciones ni ventanas superpuestas.',
        ),
      ];
    case 'actividad':
      if (teacher)
        return [
          step(
            '.page-heading',
            'Acompaña la actividad',
            'Comprueba el título y el modo. En una actividad individual cada estudiante avanza a su ritmo; en una guiada, tú controlas las preguntas.',
          ),
          step(
            '[data-guide="guided-room"] .row.between',
            'Mira quién participa',
            'Aquí aparecen el estado de la sala y la cantidad de participantes. Comprueba que tu clase haya entrado antes de comenzar.',
          ),
          step(
            '[data-guide="guided-controls"]',
            'Marca el ritmo de la clase',
            'Comenzar abre la sesión. Después puedes cerrar la pregunta y abrir la siguiente. Cerrar con pendientes pide confirmación porque puede haber estudiantes sin responder.',
          ),
          step(
            '.rich-reader',
            'Consulta el material publicado',
            'Este contenido corresponde a la versión de la actividad. Editar el borrador de la biblioteca no modifica las respuestas que ya recibiste.',
          ),
          step(
            '.page-heading .button',
            'Revisa antes de publicar notas',
            'Revisar respuestas abre las participaciones. Corrige las preguntas escritas y publica las calificaciones cuando estén listas; terminar la sesión no publica notas automáticamente.',
          ),
        ];
      return [
        step(
          '.quiz-invitation h1, .quiz-question, .page-heading',
          teacher ? 'Acompaña la actividad' : 'Antes de comenzar',
          teacher
            ? 'Consulta el estado de la actividad y los controles de avance. En modo guiado tú decides cuándo abrir la siguiente pregunta.'
            : 'Lee la actividad antes de iniciar el intento. La guía no responde ni consume oportunidades.',
        ),
        step(
          '.rules-grid',
          'Revisa las reglas',
          'Comprueba el plazo, tiempo disponible y cantidad de intentos. Estas reglas se mantienen al empezar.',
        ),
        step(
          '.quiz-invitation .button',
          'Empieza cuando estés listo',
          'Empezar sí utiliza un intento. Una vez dentro, confirma cada respuesta y espera al docente si la sesión es guiada.',
        ),
        step(
          '.question-stage',
          'Piensa antes de confirmar',
          'Selecciona o escribe tu respuesta. Una respuesta confirmada es definitiva; la ayuda no pausa el tiempo.',
        ),
        step(
          '.quiz-progress-wrap',
          'Sigue tu avance',
          'Aquí puedes ver en qué pregunta estás. Las calificaciones dependen de las reglas y de la revisión docente.',
        ),
      ];
    default:
      return [
        step(
          'main h1',
          'Conoce esta pantalla',
          'Usa la navegación para volver a tu materia. La ayuda está disponible cuando la necesites.',
        ),
      ];
  }
}
