# Acceso con correo sin confirmar

## Ensayo realizado

El registro [acceso-sin-confirmar.json](acceso-sin-confirmar.json) contiene **15 comprobaciones aprobadas** con dos cuentas ficticias nuevas, una docente y otra estudiante. Se ejecutó del **29 de septiembre de 2026, 23:57:33.026 a 23:57:36.014 UTC**, sobre el build `Uh-fjoiC7EsPHOpmME_0K` y la revisión `bb1bf43b651f378e84a6fe51d02b128c94d0330c`.

El SHA-256 del ejecutor utilizado entonces es `bd664815f8e7488d0637f535c994088bb07745bb94e4d56bf7d766fafe72ee4e`. Ese identificador y las fechas originales se conservan en el JSON; no corresponden a la versión del script endurecida después.

Para ambos roles, Supabase Auth rechazó las credenciales con `email_not_confirmed` y no emitió sesión. La API de Aulify respondió con orientación para confirmar el correo, no entregó cookie de sesión válida y rechazó el aula y las operaciones de materia sin identidad confirmada. Las cuentas continuaron sin confirmar al terminar las comprobaciones.

## Limpieza verificada

La limpieza automática inicial quedó pendiente: el perfil creado por el trigger conservaba una referencia a la cuenta Auth y bloqueó `deleteUser`. El campo `initialCleanup` mantiene ambos resultados fallidos; no se borró esa parte de la evidencia.

La limpieza posterior verificó los identificadores y correos exactos de las dos cuentas ficticias, la ausencia de sesiones y referencias, eliminó sus perfiles en una transacción y después eliminó las cuentas mediante Auth Admin. La lectura posterior devolvió 404. El JSON registra ambos fixtures como eliminados y la verificación a las **00:03:34.167 UTC del 30 de septiembre**. No se publican los identificadores ni los correos de los fixtures; el manifiesto y el procedimiento de esa limpieza permanecen privados.

## Límites

Este ensayo usa cuentas preparadas mediante Auth Admin sin enviar correo y comprueba Auth y las API de la aplicación. **No verifica el formulario en un navegador, envío SMTP, recepción o apertura de enlaces, confirmación por correo ni recuperación de contraseña.** Tampoco mide rendimiento. Las comprobaciones de un correo sin confirmar no acreditan esos recorridos adicionales.

## Protección añadida después del ensayo

El [ejecutor actual](../../tools/datos/unconfirmed-access.mjs) incorpora controles preventivos que todavía no se ejecutaron contra Supabase:

- Sin `--run`, sólo inspecciona manifiestos locales; no lee claves ni emite solicitudes. `--run` por sí solo tampoco habilita la creación: exige confirmar exactamente dos fixtures, el build esperado y rutas nuevas de informe y manifiesto.
- Las rutas históricas no se reutilizan. La creación exclusiva de archivos con `wx` impide sobrescribir informes o manifiestos existentes.
- Un manifiesto AC-01 ilegible, de otro proyecto, con fixtures pendientes o sin fecha de limpieza verificada bloquea otra preparación.
- Antes de solicitar cada cuenta se guarda su intención y correo ficticio. No se guardan contraseñas. Si se pierde la respuesta del servicio, el manifiesto conserva qué identidad debe investigarse antes de repetir el ensayo.
- No intenta borrar perfiles ni cuentas automáticamente. El resultado de las comprobaciones y la limpieza pendiente se registran por separado.

Se ejecutaron `--self-test`, el preflight sin `--run`, la comprobación de sintaxis y ESLint. Las **11 comprobaciones locales** aprobaron el bloqueo de opciones incompletas, cantidad distinta de dos, destinos históricos o fuera de alcance, manifiestos pendientes/no verificados/ilegibles y la preservación de un archivo existente. Estas comprobaciones no crearon cuentas ni enviaron tráfico. No se ejecutó `--run` durante el endurecimiento.

## Limpieza de una ejecución futura

1. Abrir su manifiesto privado exacto y confirmar proyecto, identificador y correo ficticio de cada fixture. Si falta el identificador porque la creación no devolvió resultado, investigar únicamente el correo exacto registrado; no crear otra cuenta ni borrar por prefijo.
2. Verificar que la cuenta sigue sin confirmar y que no existen sesiones ni referencias de producto. Si aparece alguna, conservar el manifiesto pendiente y revisar el caso antes de eliminar datos.
3. Eliminar únicamente esos perfiles dentro de una transacción con las comprobaciones anteriores; después eliminar sus cuentas mediante Auth Admin.
4. Comprobar que Auth devuelve 404 para cada identificador y registrar `removed: true` junto con `cleanupVerifiedAt`. Mantener los fallos iniciales, fechas y hash del ensayo; añadir el resultado de limpieza sin atribuirlo a la ejecución original.

El script privado utilizado en la primera limpieza corresponde exclusivamente a aquellos dos fixtures ya eliminados; no es un limpiador reutilizable para futuras ejecuciones.
