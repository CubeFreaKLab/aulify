# Verificación de datos en PostgreSQL aislado

El 28 de septiembre de 2026 se ejecutaron las doce migraciones de `supabase/migrations` sobre una base nueva en memoria con PGlite 0.5.8. La [evidencia JSON](datos-aislados.json) identifica motor, hora real, archivos y 84 comprobaciones explícitas aprobadas. Se utilizaron cuentas y contenido ficticios; no se conectó una base remota.

## Qué se comprobó

- Creación de materia, solicitud por código, aprobación y rechazo de operaciones de estudiante o docente ajeno.
- Borrador con conflicto de revisión, publicación normalizada de los ocho tipos de pregunta y ausencia de soluciones, guías y pistas privadas en las proyecciones estudiantiles.
- Intento recuperable, orden obligatorio, respuesta definitiva, reintento idempotente y rechazo de la misma clave con contenido distinto. Un doble por actividad y nota limitada al máximo.
- Escritura pendiente impide publicar; corrección docente y publicación separadas. Una nota agregada publicada no revela una revisión configurada como oculta.
- Sesión guiada: inscripción, inicio docente, confirmación de preguntas pendientes, omisiones, cierre final, equipos y clasificación.
- Una respuesta guiada ya confirmada conserva su reintento idempotente al cerrar la pregunta; una respuesta nueva posterior al cierre se rechaza. La carrera simultánea requiere además la comprobación remota documentada por separado.
- Tarea con archivo previamente registrado, rechazo de metadatos ficticios, revisión/publicación y reentrega autorizada conservando versiones.
- Ventana de reentrega visible para propietario y estudiante autorizado, ausente para docente ajeno y estudiante retirado, y retirada del snapshot al consumirse.
- Lectura privada del archivo, retiro, cierre administrativo y exclusión del intento. Archivo de materia, restauración válida y rechazo al alcanzar treinta días.
- Purga de relaciones y archivos exclusivos; conserva la biblioteca, y exige que Storage confirme la ausencia del objeto antes de completar el borrado.
- Los códigos inválidos consumen el límite de diez comprobaciones por diez minutos. Las ocho funciones públicas son `SECURITY INVOKER`, ninguna ejecutable por `anon`; las 47 tablas propias tienen RLS y no conceden DML directo a clientes.
- Sincronización de una actividad con huella opaca: estable sin cambios, diferente al iniciar o responder, sin señal de correcciones ocultas, y denegada a visitantes, docentes ajenos y estudiantes retirados.

- Snapshot por actividad: ámbito docente limitado, proyección estudiantil sin secretos, rechazo de docente ajeno, estudiante no inscrito y retirado. Las tablas de revisiones y su modificador interno rechazan consultas directas del cliente; la participación ajena no altera la huella estudiantil.

## Reproducción

Las dependencias de desarrollo incluyen `@electric-sql/pglite@0.5.8`. Ejecutar desde el repositorio con Node.js compatible:

```powershell
npm ci
node tools/datos/check.mjs --report docs/verificacion/datos-aislados.json
python tools/modelado/generar.py --check
```

También se admite un motor instalado por separado indicando su archivo `dist/index.js` en `PGLITE_MODULE`.

El ejecutor crea roles y esquemas mínimos de Auth y Storage, ejecuta los mismos SQL de migración y cambia de rol para comprobar permisos. No usa un simulador de consultas ni un blob global de estado. Las reservas y los objetos de archivo de la prueba representan metadatos, no una subida real de bytes.

## Límites y próxima comprobación

Estos resultados no sustituyen Auth/JWT reales, SMTP, firma y descarga de Storage, validación de contenido de archivos, conexiones simultáneas ni una prueba de carga. Tampoco acreditan accesibilidad, funcionamiento de las pantallas o despliegue. Deben repetirse los recorridos integrados con cuentas independientes y datos ficticios en el proyecto de destino; inspeccionar los asesores de Supabase y comprobar la configuración del trabajo periódico de conservación antes de declarar producción verificada.

Las migraciones no guardan credenciales, correo personal ni identidad de proyectos remotos. El contrato de aplicación está en [supabase/CONTRACT.md](../../supabase/CONTRACT.md). La limpieza se ejecuta con [maintenance.mjs](../../tools/datos/maintenance.mjs), utilizando una credencial privada de servicio; disponer del script no significa que su horario esté configurado.
