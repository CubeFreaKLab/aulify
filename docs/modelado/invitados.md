# Extensión 1.4: práctica por enlace

La migración `20261023190019_aulify_guest_practice_and_member_avatars.sql` agrega `guest_quizzes` y `guest_runs`. El [modelo JSON](modelo.json), [DBML](aulify.dbml), [diccionario](diccionario.md) y [diagrama](diagramas/10-invitados.svg) incluyen sus atributos y relaciones.

Una actividad de un docente puede originar varias copias públicas históricas, con un solo enlace activo a la vez. Cada copia tiene cero o muchas partidas invitadas. La única copia sin propietario ni actividad es el ejemplo público `ecosistema-demo`. La eliminación de la actividad o perfil elimina sus copias y partidas por cascada; archivar la materia inhabilita la consulta del enlace.

## Límites y normalización

La URL contiene una capacidad aleatoria revocable; no contiene una credencial de cuenta. Las fechas y duración de cada copia son inmutables. Para cambiar la programación se desactiva y genera otro enlace. El límite de creación es veinte enlaces por propietario al día; cada copia admite hasta trescientas partidas retenidas. Son límites de almacenamiento y abuso, no capacidad concurrente acreditada.

Las claves y relaciones normales se mantienen en columnas: propietario, actividad, copia y partida. El JSON de preguntas es una copia inmutable de un agregado publicado, con un máximo de cincuenta preguntas y 256 KiB; evita exponer el recurso privado o cambiar las reglas de una partida por una edición posterior. Los recibos de respuesta forman una secuencia acotada de hasta cincuenta elementos. Contienen identificador idempotente, puntos y explicación, sin respuestas escritas, matrícula, intención de nota ni identidad académica. Son excepciones documentadas a la descomposición relacional, limitadas a la práctica pública.

La cookie de la partida guarda un secreto aleatorio de 256 bits, HttpOnly, SameSite=Lax y Secure en HTTPS. Solo se conserva su SHA-256 en PostgreSQL. La cookie se limita a la ruta de esa práctica. El servidor comprueba apertura, cierre, duración, orden e idempotencia con bloqueo transaccional. El cliente solo recibe metadatos, su progreso y la pregunta actual sin soluciones. La explicación aparece tras confirmar una respuesta.

## Permisos y conservación

Ambas tablas están en el esquema privado `app`, con RLS y sin permisos directos para `anon` o `authenticated`. La gestión exige identidad verificada y propiedad de la materia. La RPC de participación solo admite `service_role` desde el servidor; su salida privada nunca se devuelve directamente como JSON HTTP. El código de servidor valida la respuesta con las mismas reglas de puntuación del dominio y la proyecta explícitamente.

Al entrar un nuevo invitado se eliminan partidas cuyo plazo venció hace más de treinta días. Esta limpieza es oportunista; debe incorporarse al mantenimiento periódico antes de habilitar una conservación estricta por plazo en producción. No se promete eliminación a una hora exacta. El ingreso, respuestas y resultados no escriben en `participants`, `attempts` ni `evaluation_revisions`.

El avatar de integrantes se obtiene mediante una proyección de metadatos cosméticos permitidos: cuenta propia y estudiantes o solicitantes en materias propias del docente. Solo se devuelven identificadores válidos del catálogo; nunca correo, metadata completa, rol derivado de metadata ni perfiles ajenos.

## Evidencia

Las [pruebas aisladas](../verificacion/invitados-aislado.json) comprueban propiedad, roles, disponibilidad, cookie, plazo, repetición, revocación y ausencia de notas. La [aplicación remota](../verificacion/invitados-migracion-remota.json) registra revisión y hash. Las pruebas de navegador y sus límites se registran en el estado del desarrollo; no equivalen a una prueba de carga ni de correo.
