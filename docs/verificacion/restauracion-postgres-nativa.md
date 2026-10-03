# Respaldo remoto y recuperación lógica de PostgreSQL

Registro UTC: 3 de octubre de 2026, correspondiente a la noche del 2 de octubre en Bolivia. Se utilizó el proyecto existente de Aulify en Supabase Free y PostgreSQL nativo 17.6 como destino aislado.

## Resultado comprobado

| Comprobación | Resultado |
|---|---|
| Exportación consistente de la base | Archivo custom de 6.068.752 bytes; SHA-256 registrado. |
| Estructura y datos | 83 tablas: 47 de Aulify, 27 de Auth, 8 de Storage y 1 de migraciones. |
| Cotejo después de importar | Recuentos y huellas de todas las tablas coinciden. |
| Políticas de acceso | Políticas y estados de RLS coinciden. |
| Historial de instalación | Las 25 migraciones se conservan. |
| Correspondencia de archivos | 42 objetos, identificadores, rutas, fechas y tamaños coincidentes. |
| Recuperación de bytes | 22.024.706 bytes copiados a otro directorio; todos los hashes coinciden. |
| Protección del origen | Exportación de solo lectura; no se restauró sobre Supabase. |

El [ejecutor](../../tools/datos/postgres-backup.mjs) valida el destino de origen, mantiene una instantánea exportada durante `pg_dump` y guarda los datos únicamente en carpetas excluidas de Git. La contraseña de conexión no se coloca en argumentos ni informes. Los datos de cuentas y las contraseñas cifradas de Auth permanecen dentro del respaldo privado.

El ensayo creó un clúster PostgreSQL nuevo, limitado a loopback, y lo detuvo después del cotejo. Los errores de arranque y restauración del ejecutor se resolvieron antes de registrar el resultado aprobado: manejo de tuberías de `pg_ctl` en Windows, esquema `public` inicial y representación horaria del cotejo. No fueron cambios en datos ni funciones de Aulify.

## Alcance de la conclusión

Es un respaldo remoto real y una recuperación lógica nativa, con archivos locales recuperados. Supera el ensayo anterior de PGlite porque utiliza las tablas y datos del proyecto alojado, incluido Auth. Los servicios HTTP de Supabase no se recrearon; no se verificó iniciar sesión ni descargar a través de ellos en el destino recuperado. AP-36 permanece parcial por esa comprobación, publicación y controles de liberación.

Las copias de archivos y SQL tienen fechas distintas. El cotejo encontró los mismos 42 objetos y sus metadatos; esto no demuestra una instantánea atómica para modificaciones futuras. El corte conjunto requiere una pausa de escrituras. Realtime, Vault, roles de inicio de sesión, credenciales administradas y SMTP no están incluidos.

Registros: [respaldo de PostgreSQL](respaldo-postgres.json), [restauración nativa](restauracion-postgres-nativa.json) y [copia de Storage](respaldo-storage.json). El procedimiento completo está en [operación y respaldo](../operacion/respaldo.md).
