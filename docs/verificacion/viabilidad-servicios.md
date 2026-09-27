# Viabilidad del entorno de servicios

Revisión: 27 de septiembre de 2026. Base documental inspeccionada: `8134fe7e6cf644a507612837b2eb2056265f8c65`; base web en construcción en el árbol de trabajo.

**Resultado: T-01 sigue pendiente.** La inspección permite continuar el prototipo con datos ficticios; no permite afirmar que Supabase, RLS, Storage o recuperación por correo funcionen en Aulify.

## Comprobación realizada

Se ejecutaron consultas de presencia y estado. No se instalaron herramientas, crearon recursos, modificaron servicios ni leyeron valores de credenciales.

| Elemento | Procedimiento | Resultado observado |
|---|---|---|
| Node.js | `node --version` | 24.14.1 disponible. |
| Docker CLI | `Get-Command docker` y `docker version` | Cliente 28.3.3 disponible. |
| Motor de contenedores | `docker info` y `docker ps` | Sin conexión al motor Linux de Docker Desktop: el named pipe no existe. No fue posible enumerar contenedores. |
| Supabase CLI | `Get-Command supabase`; comprobar ejecutable local del proyecto | No encontrado en PATH ni en `node_modules/.bin/supabase.cmd` al inspeccionar. |
| Configuración de proyecto local | Comprobar `supabase/config.toml` | Archivo ausente; no hay una instancia local de Aulify identificada. |
| Configuración de conexión | Enumerar nombres `.env*` de la raíz y nombres de variables `SUPABASE*` del proceso | No encontrados en esos lugares. No se exploraron credenciales de otros proyectos ni se imprimieron valores. |
| Conexión especializada a Supabase | Consultar capacidades disponibles | No hay conexión de Supabase disponible para esta revisión. Esto no demuestra que la cuenta carezca de proyectos externos. |
| Esquema y seguridad | Revisar plan y modelo lógico | Modelo disponible; no se han aplicado migraciones ni comprobado restricciones/RLS contra PostgreSQL. |

Los fallos de Docker indican que el motor esperado no estaba accesible en esta sesión; no prueban la causa ni que Docker Desktop deba reinstalarse. La ausencia de una CLI en PATH tampoco excluye una instalación fuera de los lugares comprobados.

## Qué falta para ejecutar la prueba mínima

La ruta propuesta es una instancia local aislada con datos ficticios. Supabase local requiere un motor compatible con Docker, la CLI y configuración por proyecto. La CLI puede fijarse como dependencia de desarrollo; no hace falta vincular una cuenta remota para iniciar la pila local. [Guía oficial de desarrollo local](https://supabase.com/docs/guides/local-development/cli/getting-started).

1. Disponer de un motor Docker operativo y confirmar el contexto de ejecución.
2. Fijar Supabase CLI, inicializar una configuración identificada para pruebas y levantar servicios locales. Mantener credenciales fuera de informes y control de versiones.
3. Derivar un subconjunto coherente del modelo: identidad/perfil, materia, solicitud y membresía; crear migraciones, restricciones y permisos reales.
4. Probar docente propietario, estudiante pendiente, estudiante aprobado y cuenta ajena. Comprobar lectura/escritura permitida y denegada, aprobación repetida y manipulación de identificadores.
5. Crear un bucket privado de prueba y verificar carga, consulta y descarga autorizada, además del rechazo a otra materia o usuario.
6. Ejecutar recuperación con el buzón local de pruebas y registrar el resultado. Esa comprobación verifica el flujo local, no entrega de mensajes a Internet.

No ejecutar `db reset`, migraciones ni pruebas destructivas contra una base remota desconocida. Si se utiliza un proyecto remoto, antes deben identificarse proyecto, entorno de pruebas, acceso, plan sin cobros y alcance de operaciones.

## Correo y límites de T-01

Para recuperación real con destinatarios externos falta seleccionar y configurar SMTP, verificar remitente y cuotas, y probar entrega y consumo del enlace. El correo predeterminado de Supabase está restringido a direcciones del equipo y tiene límites reducidos; no se considera solución definitiva. [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

La prueba mínima de datos y archivos tampoco cierra por sí sola T-01. La tarea incluye elegibilidad de servicios gratuitos, alojamiento y transporte de sincronización frente a cuotas y carga objetivo. No se ha demostrado capacidad para cuatro actividades de 50 estudiantes más sus docentes, continuidad ni respaldo.

| Comprobación del producto | Estado de esta revisión |
|---|---|
| Acceso y recuperación con proveedor real | No ejecutada. |
| Materia y aprobación persistidas en PostgreSQL | No ejecutada. |
| RLS con cuentas de roles distintos | No ejecutada. |
| Archivo privado y aislamiento entre materias | No ejecutada. |
| SMTP externo y enlace de recuperación | No configurado ni ejecutado. |
| Transporte guiado, cuotas y carga objetivo | Pendiente de experimento. |
| Despliegue | No realizado; producción fuera del prototipo. |

La siguiente evidencia debe indicar migración, versión de CLI, contexto local, identidades ficticias, operaciones autorizadas y denegadas, resultados y limitaciones. Las pruebas visuales y la persistencia local del prototipo se documentan por separado: no sustituyen permisos reales ni permiten marcar los casos integrados como aprobados.
