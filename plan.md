# Plan técnico de Aulify

**Actualizado el 17 de octubre de 2026.** Aplicación integrada con Supabase, migraciones aplicadas y verificaciones de datos y navegador realizadas. Hay una vista previa HTTPS protegida; capacidad, correo general y liberación de producción continúan en comprobación. El [estado del desarrollo](docs/estado-del-desarrollo.md) identifica resultados y límites.

Los comportamientos del producto están en [specification.md](specification.md), el recorrido inicial en [entrega 001](specs/001-recurso-interactivo/spec.md) y las decisiones de alcance en sus casos de aceptación. Este plan explica cómo se construye y verifica la solución.

La [entrega de carrusel y guías contextuales](docs/diseno/carrusel-y-guia-contextual.md) del 23 de octubre utiliza React/CSS y React Aria existentes. El foco visual mide controles reales; la preferencia inicial conserva el contrato por cuenta y las páginas se recuerdan localmente por perfil. Las columnas son bloques anidados del documento JSON existente, con lectura equivalente y apilado móvil; no requieren tablas ni migraciones nuevas. El carrusel usa una posición continua con módulo para envolver las siete tarjetas, inercia y eventos de rueda pasivos. El lápiz se monta solo en la portada, sin interceptar eventos. El pegado usa el ClipboardEvent de BlockNote y la misma validación/carga de imágenes existente; solicita texto alternativo antes de insertar. Las lecturas de demo guardan referencias locales a versiones inmutables y materias, sin crear intentos ni notas; las cuentas conservan el comando remoto de publicación existente. Los controles animados mantienen alternativas de clic y teclado y respetan movimiento reducido.

## 1. Arquitectura implementada

Una aplicación Next.js organiza interfaz, endpoints y contratos de dominio en módulos del mismo repositorio. PostgreSQL ejecuta las operaciones sensibles de forma transaccional. No hay microservicios ni despliegues independientes por módulo.

| Componente | Implementación | Responsabilidad |
|---|---|---|
| Web | Next.js 16.3.6, React 19.3.0, TypeScript 6.0.3 | Rutas públicas, aula autenticada, interfaz y endpoints del servidor. |
| Controles y editor | React Aria Components 1.21.1; BlockNote 0.55.0; Inter | Controles accesibles compuestos con estilos propios y editor por bloques. |
| Identidad | Supabase Auth, Free | Correo/contraseña y sesiones; confirmación y recuperación requieren SMTP operativo. |
| Base de datos | PostgreSQL 17 de Supabase, Free | Relaciones, restricciones, operaciones, versiones, evaluación y permisos. |
| Archivos | Supabase Storage privado | Subida directa autorizada, verificación de bytes y descarga temporal. |
| Sincronización | Consulta periódica de huella de actividad | Actualizar datos autorizados cuando cambian; comprobar capacidad y latencia. |
| Demostración | Adaptador local | Datos ficticios sin cuentas externas; no representa una frontera de autorización. |
| Pruebas | Vitest, Playwright, axe y PGlite | Reglas, interfaz, comprobaciones automáticas de accesibilidad y SQL aislado. |
| Integración continua | GitHub Actions | Formato, análisis, tipos, unidad, SQL, construcción y recorridos públicos. |
| Alojamiento previsto | Vercel Hobby | Publicación por HTTPS tras cumplir las comprobaciones; uso gratuito elegible. |

Las versiones y dependencias están fijadas en `package.json` y `package-lock.json`. Las bibliotecas no certifican por sí solas accesibilidad, seguridad o capacidad. Las decisiones previas se conservan en [ADR 0001](docs/decisiones/0001-supabase.md), [0003](docs/decisiones/0003-modelo-relacional.md) y [0004](docs/decisiones/0004-base-web.md).

## 2. Identidad y permisos

`/aula` requiere una sesión validada de Supabase. El servidor vuelve a comprobar identidad en las operaciones; no confía en el identificador de actor que envíe el navegador. El perfil persistente se establece al crear la cuenta y no cambia al modificar los metadatos editables de Auth.

Las 47 tablas propias tienen RLS y no conceden escritura directa a los roles cliente. Nueve funciones públicas invocadoras constituyen la frontera de datos; las funciones internas del esquema privado comprueban identidad, propiedad y pertenencia antes de operar. Las funciones privilegiadas internas usan un contexto de búsqueda restringido. El [contrato](supabase/CONTRACT.md) identifica acciones y proyecciones.

Las respuestas correctas, guías privadas, borradores y notas sin publicar no se incorporan a la proyección estudiantil. Al cerrar sesión se limpian datos, revisiones y respuestas pendientes en memoria. Las operaciones de una sesión antigua no pueden repoblar el estado de otra cuenta.

Las claves privadas quedan en variables de servidor. La clave publicable puede utilizarse en el cliente; no reemplaza la autorización. Las solicitudes de cambio se comprueban frente al origen y al tipo/tamaño de contenido permitido.

## 3. Modelo y migraciones

El [modelo 1.3](docs/modelado/README.md) reúne 44 relaciones del dominio y tres técnicas para límites de frecuencia y revisiones de sincronización, con Auth externo. Incluye diccionario, DBML, diagramas, normalización, invariantes y permisos. Las treinta y siete migraciones versionadas y aplicadas materializan el modelo, comandos, proyecciones, conservación, reservas de archivo, reentregas y sincronización. También optimizan permisos por consulta, serializan respuesta y cierre guiado, limitan la proyección a la actividad abierta y conservan la clasificación publicada durante una corrección privada. La migración 16 separa el contador docente por participante; el sondeo posterior no aprobó capacidad. La 17 unifica la validación de destinos del editor y protege la publicación de versiones. Las migraciones 18 a 20 reducen trabajo de proyección docente, consulta del contexto de sincronización y serialización de preguntas estudiantiles, conservando contratos y permisos comprobados. La migración 21 cuenta la retención de señales desde el cierre efectivo de la actividad. La 22 separa el resumen de materias del contenido completo de los quizzes y detecta revisiones pendientes sin recalcular puntuaciones. La 23 aplica la detección por existencia también al cálculo de completitud de intentos. Conservan el historial y la autorización. Los informes anteriores identifican su propio corte de migraciones. Las migraciones 24 a 29 ajustan agrupaciones de preguntas, reintento de purga, confirmaciones y sondeo del servidor. Las migraciones 30 y 31 agrupan el contexto del sondeo y reutilizan planes de las RPC frecuentes. La 32 consulta el historial de intentos y evaluaciones por conjuntos, conservando las versiones publicadas y los permisos. La 33 permite adaptar los planes del resumen general al ámbito de cada cuenta; su [verificación](docs/verificacion/historial-conjuntos-20261017.md) no sustituye el ensayo de capacidad. Las migraciones 34 y 35 añaden avisos privados de actividad y evitan duplicarlos por estudiante cuando la misma transacción ya publica un cambio común. No agregan entidades ni cambian notas o permisos. La migración 36 contrasta la revisión de la proyección inicial; la 37 mantiene el mismo identificador al repetir una aprobación, sin duplicar inscripciones o eventos.

PGlite reproduce las migraciones en una base nueva y comprueba restricciones y accesos. Los ensayos remotos utilizan Auth, JWT, PostgreSQL y Storage reales; cada evidencia conserva sus límites. El JSONB de los bloques se valida y versiona, sin sustituir las relaciones de materias, integrantes, intentos, respuestas y evaluaciones.

Las versiones publicadas son independientes del borrador. Un guardado concurrente sobre una revisión antigua se rechaza como conflicto. Una respuesta mantiene la versión y el orden utilizados por su intento.

## 4. Quiz, plazos y notas

- Los plazos y cierres se validan con hora de servidor; la interfaz solo presenta su estado.
- El registro de respuesta es definitivo e idempotente. Repetir una clave con igual contenido devuelve el resultado existente; cambiar su contenido se rechaza.
- Pregunta disponible, pertenencia, intentos y consumo de potenciadores se comprueban en la operación transaccional.
- Las respuestas escritas quedan pendientes de corrección. La evaluación y su publicación son acciones diferentes.
- El promedio utiliza resultados normalizados y pesos. Lo pendiente no se trata como cero; el docente debe decidir la no participación.
- Los equipos conservan calificaciones individuales. La clasificación usa alias y respeta la política de visibilidad.
- Una señal de pérdida de visibilidad de la pestaña no identifica otras aplicaciones ni prueba una trampa. El docente revisa incidencias sin sanción automática.

## 5. Sincronización y carga

En una actividad activa, el docente consulta cada segundo una huella opaca mediante `/api/sync`. El estudiante recibe avisos SSE de `/api/events`, vuelve a comprobar esa huella cuando llega un cambio y mantiene una comprobación de respaldo cada treinta segundos y al vencer un plazo. Si pierde el canal, consulta cada segundo. La huella combina revisiones técnicas y plazos; solo se descarga la proyección de esa actividad al detectar cambios. La consulta se suspende durante una respuesta propia. El ACK se incorpora inmediatamente y descarta lecturas anteriores que podrían hacer retroceder el intento. Solo evita la descarga repetida cuando coinciden la base conocida, la revisión confirmada y la marca de proyección completa. Ante fallos temporales espacia reintentos a uno, dos, cuatro y ocho segundos. Las otras pantallas consultan el resumen cada cuatro segundos; la consulta se suspende cuando la página está oculta.

La huella no incluye respuestas ajenas ni cambia al corregir datos todavía ocultos. El servidor comparte un canal privado de Supabase por actividad e instancia y distribuye avisos mínimos entre sus conexiones SSE autorizadas. Los navegadores no conectan directamente con Realtime. Una operación guiada utiliza sus avisos comunes para evitar mensajes redundantes por participante. La [decisión 0005](docs/decisiones/0005-avisos-de-actividad.md) explica acceso, recuperación y límites. La capacidad se comprueba con los endpoints reales y los consumos de ambos servicios; esta decisión no la acredita por sí sola. [Límites de Realtime](https://supabase.com/docs/guides/realtime/limits).

El transporte de servidor mantiene un máximo de 128 conexiones HTTP/1.1 por origen e instancia: 96 para lecturas y otras operaciones y 32 reservadas para comandos. Se mantienen doce segundos por operación y cancelación, sin reenvío automático de escrituras. La [verificación de esta separación](docs/verificacion/conexiones-reservadas.md) distingue el aislamiento local de la capacidad remota todavía pendiente.

El lote de sincronización resuelve como conjuntos las identidades autorizadas y reutiliza el contexto de cada actividad dentro de la consulta. No mantiene una caché de permisos. Conserva las huellas y los plazos del contrato individual, el rechazo independiente de cada identidad y el acceso exclusivo desde el servidor. La [comparación aislada](docs/verificacion/sync-lotes-conjuntos.md) registra sus resultados y distingue esta optimización de la medición completa de capacidad.

El servidor programa una ventana de 160 ms para formar cada lote, con un máximo de 64 lecturas y 1.024 lecturas distintas en curso por instancia. La deduplicación solo dura mientras se resuelve la solicitud; no conserva resultados ni autorizaciones entre consultas. Las rutas de sincronización, lectura y comandos verifican y renuevan su propia sesión, sin una segunda pasada previa del proxy. Las páginas autenticadas, el acceso y los archivos conservan esa pasada cuando la necesitan. La reducción de trabajo y de invocaciones debe contrastarse con el ensayo de capacidad y las cuotas observadas.

Las funciones RPC de comandos, lectura de actividad y sincronización agrupada reutilizan planes genéricos de PostgreSQL dentro de su ejecución. El resumen general y sus agregaciones usan planes con los parámetros actuales porque sus ámbitos docente y estudiantil tienen tamaños muy distintos. El ajuste conserva los parámetros actuales, las consultas de permisos y las transacciones; no guarda datos de una identidad para otra. Su alcance y los perfiles orientativos se registran en [planes RPC](docs/verificacion/planes-rpc-20261017.md).

Q-06 conserva cuatro grupos de cincuenta estudiantes y cuatro docentes, diez preguntas por actividad y dos fases separadas de cinco minutos de calentamiento más quince de medición. Los objetivos y la ráfaga están en el [plan de calidad](docs/calidad/plan-de-calidad.md). No reducir umbrales después de medir.

## 6. Archivos y conservación

La aplicación reserva una ruta privada y emite una autorización de subida directa. Así evita pasar todo el archivo por el límite de cuerpo de una función de alojamiento. Antes de registrar la carga, el servidor descarga y valida tamaño, firma y estructura; conserva su huella SHA-256. Las imágenes de recursos admiten hasta 5 MiB y los adjuntos de tareas hasta 10 MiB.

La descarga comprueba acceso vigente y emite una URL de sesenta segundos. Un estudiante retirado o un docente ajeno no obtiene una URL. Las reentregas autorizadas preservan versiones y evaluaciones anteriores.

El flujo `mantenimiento.yml` está programado cada seis horas. Ejecuta cierres y purga registros vencidos; confirma la ausencia en Storage antes de completar la eliminación de sus metadatos. Utiliza secretos protegidos de Actions. El horario no constituye una garantía de disponibilidad: deben inspeccionarse resultados, reintentarse fallos y contrastarse el objetivo Q-08 de veinticuatro horas. La restauración de respaldo operativo permanece por comprobar.

## 7. Interacción y accesibilidad

Las pantallas principales funcionan en escritorio y móvil emulado. El editor ofrece menú de bloques, formato, alternativas de reordenamiento por teclado, vista previa y publicación explícita. La configuración agrupa detalles en opciones avanzadas. La ayuda inicial es opcional y puede reabrirse.

La revisión del 29 de septiembre añade navegación móvil modal con gestión de foco, una biblioteca con muestras del contenido y ordenación, y controles de ancho/alineación de imágenes compartidos con el lector. Estos valores se conservan en el documento JSON existente; no requieren nuevas tablas. Una paleta común adapta los colores de texto y fondo del editor a la lectura y a ambos temas. El video utiliza carga explícita y un enlace alternativo; las pruebas del reproductor emplean una respuesta externa simulada y no acreditan la disponibilidad del proveedor. Véase la [evidencia de biblioteca y editor](docs/diseno/revision-biblioteca-editor-2026-09-29.md).

Los temas claro, oscuro y del sistema conservan la identidad de Aulify. El movimiento respeta la preferencia de reducción; sonidos y rachas no deben revelar aciertos configurados como ocultos. Se mantienen tablas equivalentes a los gráficos y controles sin depender únicamente del color.

Playwright y axe comprueban vistas concretas. Las pruebas con lector de pantalla, teléfonos físicos y participantes deben registrarse aparte; no se declara conformidad completa a [WCAG 2.2](https://www.w3.org/TR/WCAG22/) a partir de una batería automática. Diseño y construcción son iterativos; las réplicas de Figma se documentan según su ejecución real.

## 8. Verificación y liberación

La revisión del 17 de octubre fija la carga de la versión en una clase de treinta estudiantes y su docente, en ambos modos. El [perfil classroom-30-v1](docs/calidad/escenario-clase-30.md) mantiene los límites de tiempos, errores e integridad, acota duración y consumo y todavía no está aprobado. El objetivo histórico de 200 permanece no validado; no se repetirán sus ensayos largos como parte de este cierre.

Las [pruebas aisladas](docs/verificacion/datos-aislados.md), [remotas](docs/verificacion/datos-remotos.md) y [web](docs/verificacion/integracion-web.md) identifican entorno, casos y resultados. Los 76 escenarios AC/AP se relacionan en la [trazabilidad](docs/calidad/trazabilidad.md); sus criterios completos siguen vigentes.

El CI público usa Node.js 24, dependencias fijadas y acciones fijadas por commit, con permisos de lectura. Ejecuta SQL en PGlite y recorridos públicos sin credenciales de usuarios. Los ensayos autenticados se habilitan expresamente en un entorno privado, con cuatro cuentas ficticias y sin trazas o vídeos del acceso.

La [ejecución anterior](https://github.com/CubeFreaKLab/aulify/actions/runs/36343447881) corresponde al prototipo. El estado de cada revisión integrada debe comprobarse en [Actions](https://github.com/CubeFreaKLab/aulify/actions). La protección de ramas y la vinculación de despliegues a los controles no se dan por configuradas por la mera existencia de YAML.

Antes de cerrar producción: verificar SMTP, carga y cuotas, despliegue HTTPS, recorridos esenciales y recuperación. El correo predeterminado de Supabase no sirve para registro general. No activar facturación para resolver una limitación. [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [planes y costos](docs/costos-servicios.md).

El [estado del desarrollo](docs/estado-del-desarrollo.md) y las [tareas](tasks.md) registran qué queda abierto.
