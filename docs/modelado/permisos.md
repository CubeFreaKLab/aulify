# Permisos, publicación y conservación

Modelo de autorización del producto. Las migraciones implementan RLS y contratos comprobados en PostgreSQL aislado; las pruebas contra Auth/Storage reales y el despliegue remoto se registran por separado. Consultar [pruebas de datos](../verificacion/datos-aislados.md).

## Principio de acceso

Toda operación obtiene la identidad de una sesión verificada, no de un `user_id`, rol o nota enviado por el cliente. La pertenencia vigente y el propietario se comprueban en servidor. Una materia archivada o en eliminación revoca acceso estudiantil. Retirar no borra historial y reaprobar no crea otra membresía.

El esquema `app` organiza las relaciones internas y no está expuesto en Data API. Los contratos explícitos devuelven solo datos autorizados. Las migraciones definen GRANT, RLS y funciones de entrada; las credenciales administrativas no sustituyen comprobaciones de usuario. Las tablas técnicas de revisión tampoco tienen acceso directo desde clientes.

## Matriz de permisos

| Información u operación | Docente propietario | Estudiante aprobado | Pendiente/retirado/ajeno | Proceso interno |
|---|---|---|---|---|
| Perfil propio y ayuda | Consulta/edición permitida de nombre y preferencia; rol fijo. | Igual, solo su cuenta. | Solo su cuenta; sin datos de materia. | Alta y operación de identidad autorizadas. |
| Materia | Crear, configurar, archivar, restaurar dentro de plazo. | Datos de materia activa autorizada. | Solo identificación mínima al solicitar por código válido. | Purga según plazo. |
| Código y solicitudes | Ver/renovar/desactivar; aprobar/rechazar las de su materia. | Solicitar; ver estado propio. | Solicitar con cuenta confirmada; ver estado propio. | Límite de frecuencia; no aprobación automática. |
| Integrantes | Datos necesarios para administrar sus grupos. | Sin listado personal completo; alias de actividad si procede. | Ninguno. | Comprobar pertenencia. |
| Recurso y borrador | Su biblioteca; crear y editar borrador. | Ninguno sobre borrador o biblioteca privada. | Ninguno. | Validar publicación. |
| Versión compartida | Consulta propia y asignación autorizada. | Solo versión asignada a actividad publicada de materia activa. | Ninguno. | Proyecciones de contenido sin secretos. |
| Soluciones, guía, explicación y pista | Consulta propia. | Revisión según política; pista únicamente tras consumo válido. Guía manual siempre privada. | Ninguno. | Cálculo o proyección mínima autorizada. |
| Intentos y respuestas | Consulta de sus materias; no responder por estudiante. | Crear/responder/retomar el propio si vigente; envío definitivo. | Ninguno. | Cerrar por plazo, retiro o archivo con causa. |
| Correcciones por pregunta | Corregir con límites, motivo e historial. | Resultado automático inmediato si la política lo permite; revisión posterior según publicación y visibilidad. Sin acceso genérico a revisiones privadas. | Ninguno. | Corrección automática o por omisión según reglas. |
| Evaluación y promedio | Preparar, publicar y revisar; lectura de materia archivada. | Última nota publicada propia. | Ninguno. | Calcular sin convertir pendientes en cero. |
| Clasificación y equipos | Configurar antes de comenzar y consultar. | Alias y puntos permitidos de su actividad; nunca correos/identidades de otros. | Ninguno. | Calcular proyecciones consistentes. |
| Entregas y archivos | Consultar/corregir los de sus materias; no sustituir envío ajeno. | Crear entrega propia y descargar archivos propios autorizados. | Ninguno. | Validar tamaño/tipo, limpiar huérfanos y borrar exclusivos. |
| Señales e incidencias | Revisar contexto mínimo de sus actividades. | Aviso de registro y límites; sin acceso a señales de compañeros. | Ninguno. | Registrar si habilitado, deduplicar y purgar detalle. |
| Trabajos de purga | Sin ejecución directa ni restauración vencida. | Ninguno. | Ninguno. | Solo operación interna con permisos mínimos. |

## Puntos que una política por fila no resuelve sola

Permitir ver una fila no implica permitir escribir sus columnas sensibles. Separar comandos para publicar nota, modificar plazo, aprobar y responder; no conceder UPDATE genérico de actividad/evaluación al estudiante. Borradores y soluciones necesitan acceso distinto al contenido compartido. Las vistas y funciones también requieren revisión de permisos; algunas formas pueden ejecutar con privilegios de su propietario. [RLS en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Los archivos permanecen en buckets privados. Autorizar la lectura por referencias vigentes y rol antes de emitir un acceso temporal; una ruta difícil de adivinar no concede privacidad. Las reglas de Storage se comprueban junto con las de las tablas de producto. [Control de acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control).

## Publicar no equivale a revelar todo

Una nota agregada publicada puede consultarse aunque estén ocultas las respuestas correctas. Para revisión diferida se exigen cierre efectivo y publicación; para ocultar siempre nunca se envían soluciones, puntos por pregunta ni rachas/clasificación estudiantiles. La guía manual privada tampoco se publica como explicación.

El vínculo `evaluation_question_grades` congela qué correcciones sustentan una evaluación. Corregir una pregunta después no debe filtrar una nueva puntuación por consultar «la última corrección» cuando todavía está sin publicar. Los gráficos estudiantiles usan las publicaciones propias; el docente dispone de bandeja de corrección privada.

La retroalimentación automática inmediata es un contrato distinto de la consulta de nota: puede devolver los puntos de la respuesta recién confirmada cuando JU-01 y JU-02 lo permitan, sin publicar una evaluación final. Clasificación y rachas también se devuelven mediante proyecciones específicas según esas reglas; no mediante SELECT libre de todas las correcciones.

## Ciclo de conservación

1. Archivar marca la materia y registra evento; cierra intentos abiertos por causa administrativa. Mientras permanezca archivada es de solo lectura para el docente.
2. Restaurar antes de 30 días cancela el trabajo vigente y restablece acceso de miembros aprobados. No reabre intentos ni amplía fechas. Las resoluciones administrativas se realizan después de restaurar.
3. Al alcanzar 30 días, el proceso bloquea restauración y revalida estado. Retira referencias de materia y elimina solo objetos sin referencias de biblioteca u otras materias.
4. Borrar dependencias de materia: actividades, participantes, intentos, respuestas, evaluaciones, entregas, solicitudes, membresías y eventos. Las cascadas del DBML son un diseño de integridad, no un reemplazo del trabajo de archivos ni permiso de borrado manual.
5. Conservar cuentas, biblioteca, versiones independientes y objetos que estas referencien. El trabajo concluido puede conservar un ID operativo sin FK a materia ni contenido personal; documentar retención técnica al implementar.

Señales de visibilidad tienen una retención distinta: 30 días tras cierre efectivo de actividad; su resolución mínima permanece mientras exista la materia. No establecer FK desde resolución a una señal individual que obligue a conservar todo el detalle. Registrar únicamente código de error y contexto técnico mínimo en procesos de limpieza.

Respaldos del proveedor y objetos activos tienen ciclos distintos. La versión de producción deberá documentar respaldo, recuperación y retención disponible; el modelo no promete borrado instantáneo de copias externas.

## Casos negativos obligatorios

- Estudiante pendiente o retirado intenta leer actividad, archivo y nota usando IDs válidos.
- Docente de otra materia intenta publicar una evaluación o aprobar una solicitud ajena.
- Estudiante aprobado consulta una versión de biblioteca no asignada, soluciones o revisión privada.
- Cliente intenta cambiar su rol, puntos, peso, pertenencia o bandera de publicación.
- Petición repetida usa clave ajena, pregunta de otro intento o contenido distinto.
- Descarga usa un archivo compartido cuya referencia autorizada ya terminó.

Estos casos complementan AC-06, AC-26 y AP-20 a AP-33. Solo las ejecuciones reales contra políticas y operaciones demostrarán autorización correcta.

## Lectura por actividad

`aulify_activity_snapshot` comprueba identidad y pertenencia actual en cada llamada. El docente recibe únicamente el ámbito solicitado; el estudiante, su proyección sin soluciones ni correcciones ocultas. Los contadores internos de sincronización carecen de lectura y escritura directa para clientes. Una retirada revoca la consulta aunque el cliente conserve una revisión antigua.
