# Plan técnico de Aulify

**Actualizado el 29 de septiembre de 2026.** Aplicación integrada con Supabase, migraciones aplicadas y verificaciones de datos y navegador realizadas. Carga, correo general y despliegue continúan en comprobación. El [estado del desarrollo](docs/estado-del-desarrollo.md) identifica resultados y límites.

Los comportamientos del producto están en [specification.md](specification.md), el recorrido inicial en [entrega 001](specs/001-recurso-interactivo/spec.md) y las decisiones de alcance en sus casos de aceptación. Este plan explica cómo se construye y verifica la solución.

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

El [modelo 1.3](docs/modelado/README.md) reúne 44 relaciones del dominio y tres técnicas para límites de frecuencia y revisiones de sincronización, con Auth externo. Incluye diccionario, DBML, diagramas, normalización, invariantes y permisos. Las veintidós migraciones versionadas y aplicadas materializan el modelo, comandos, proyecciones, conservación, reservas de archivo, reentregas y sincronización. También optimizan permisos por consulta, serializan respuesta y cierre guiado, limitan la proyección a la actividad abierta y conservan la clasificación publicada durante una corrección privada. La migración 16 separa el contador docente por participante; el sondeo posterior no aprobó capacidad. La 17 unifica la validación de destinos del editor y protege la publicación de versiones. Las migraciones 18 a 20 reducen trabajo de proyección docente, consulta del contexto de sincronización y serialización de preguntas estudiantiles, conservando contratos y permisos comprobados. La migración 21 cuenta la retención de señales desde el cierre efectivo de la actividad. La 22 separa el resumen de materias del contenido completo de los quizzes y detecta revisiones pendientes sin recalcular puntuaciones. Conserva el historial y la autorización. Los informes anteriores identifican su propio corte de migraciones.

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

En una actividad activa, el navegador consulta cada segundo una huella opaca del estado autorizado mediante `/api/sync`. Esta huella combina revisiones técnicas y plazos; solo descarga la proyección de esa actividad al detectar cambios. Al volver a otras pantallas recupera el resumen del aula con su historial e invalida las consultas anteriores. Ante fallos temporales, espacia reintentos a uno, dos, cuatro y ocho segundos; al recuperar conexión vuelve a consultar el estado. Las otras pantallas consultan su estado cada cuatro segundos; la consulta se suspende cuando la página está oculta. Una respuesta confirmada por el servidor se incorpora inmediatamente y descarta lecturas anteriores que podrían hacer retroceder el intento.

La huella no incluye respuestas ajenas ni cambia al corregir datos que el estudiante todavía debe tener ocultos. La consulta periódica evita depender de 204 conexiones Realtime, por encima de la cuota Free de 200 publicada. La decisión no demuestra por sí sola capacidad: la prueba mide los endpoints HTTP reales, sus latencias, errores y consumo. [Límites de Realtime](https://supabase.com/docs/guides/realtime/limits).

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

Las [pruebas aisladas](docs/verificacion/datos-aislados.md), [remotas](docs/verificacion/datos-remotos.md) y [web](docs/verificacion/integracion-web.md) identifican entorno, casos y resultados. Los 76 escenarios AC/AP se relacionan en la [trazabilidad](docs/calidad/trazabilidad.md); sus criterios completos siguen vigentes.

El CI público usa Node.js 24, dependencias fijadas y acciones fijadas por commit, con permisos de lectura. Ejecuta SQL en PGlite y recorridos públicos sin credenciales de usuarios. Los ensayos autenticados se habilitan expresamente en un entorno privado, con cuatro cuentas ficticias y sin trazas o vídeos del acceso.

La [ejecución anterior](https://github.com/CubeFreaKLab/aulify/actions/runs/36343447881) corresponde al prototipo. El estado de cada revisión integrada debe comprobarse en [Actions](https://github.com/CubeFreaKLab/aulify/actions). La protección de ramas y la vinculación de despliegues a los controles no se dan por configuradas por la mera existencia de YAML.

Antes de cerrar producción: verificar SMTP, carga y cuotas, despliegue HTTPS, recorridos esenciales y recuperación. El correo predeterminado de Supabase no sirve para registro general. No activar facturación para resolver una limitación. [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [planes y costos](docs/costos-servicios.md).

El [estado del desarrollo](docs/estado-del-desarrollo.md) y las [tareas](tasks.md) registran qué queda abierto.
